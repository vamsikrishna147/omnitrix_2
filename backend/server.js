const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const archiver = require('archiver');

const app = express();
app.use(cors());
app.use(express.json());

const WORKSPACE_DIR = path.join(__dirname, 'workspace');

// Ensure workspace exists
if (!fs.existsSync(WORKSPACE_DIR)) {
    fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
}

// 1. Get File Tree
app.get('/api/files', (req, res) => {
    function readDirRecursive(dir, relativePath = '') {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const nodes = [];
        for (const entry of entries) {
            if (entry.name === 'node_modules' || entry.name === '.git') continue;
            
            const currentPath = path.join(dir, entry.name);
            const nodeRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
            
            if (entry.isDirectory()) {
                nodes.push({
                    type: 'folder',
                    name: entry.name,
                    path: nodeRelativePath,
                    children: readDirRecursive(currentPath, nodeRelativePath)
                });
            } else {
                nodes.push({
                    type: 'file',
                    name: entry.name,
                    path: nodeRelativePath
                });
            }
        }
        
        // Sort folders first, then files
        nodes.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
        
        return nodes;
    }

    try {
        const tree = readDirRecursive(WORKSPACE_DIR);
        res.json({ tree });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Read File Content
app.get('/api/files/content', (req, res) => {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: 'Path is required' });
    
    const fullPath = path.join(WORKSPACE_DIR, filePath);
    try {
        if (!fullPath.startsWith(WORKSPACE_DIR)) throw new Error('Invalid path');
        const content = fs.readFileSync(fullPath, 'utf-8');
        res.json({ content });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Create File/Folder
app.post('/api/files', (req, res) => {
    const { path: reqPath, isFolder } = req.body;
    if (!reqPath) return res.status(400).json({ error: 'Path is required' });

    const fullPath = path.join(WORKSPACE_DIR, reqPath);
    try {
        if (!fullPath.startsWith(WORKSPACE_DIR)) throw new Error('Invalid path');
        
        // ensure parent directories exist
        const dirName = isFolder ? fullPath : path.dirname(fullPath);
        fs.mkdirSync(dirName, { recursive: true });

        if (!isFolder) {
            fs.writeFileSync(fullPath, `// New file: ${path.basename(fullPath)}`, 'utf-8');
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. Update File
app.put('/api/files', (req, res) => {
    const { path: reqPath, content } = req.body;
    if (!reqPath) return res.status(400).json({ error: 'Path is required' });

    const fullPath = path.join(WORKSPACE_DIR, reqPath);
    try {
        if (!fullPath.startsWith(WORKSPACE_DIR)) throw new Error('Invalid path');
        fs.writeFileSync(fullPath, content || '', 'utf-8');
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. Delete File/Folder
app.delete('/api/files', (req, res) => {
    const reqPath = req.query.path;
    if (!reqPath) return res.status(400).json({ error: 'Path is required' });

    const fullPath = path.join(WORKSPACE_DIR, reqPath);
    try {
        if (!fullPath.startsWith(WORKSPACE_DIR)) throw new Error('Invalid path');
        if (fs.existsSync(fullPath)) {
            fs.rmSync(fullPath, { recursive: true, force: true });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 6. Execute Code
app.post('/api/execute', (req, res) => {
    const { path: reqPath } = req.body;
    if (!reqPath) return res.status(400).json({ error: 'Path is required' });

    const fullPath = path.join(WORKSPACE_DIR, reqPath);
    const ext = path.extname(fullPath).toLowerCase();
    
    let command = '';
    // Determine command based on extension
    if (ext === '.js') {
        command = `node "${fullPath}"`;
    } else if (ext === '.py') {
        command = `python "${fullPath}"`; // or python3 depending on system
    } else if (ext === '.c') {
        const outName = fullPath.replace('.c', '.exe'); // Assuming windows based on user OS
        command = `gcc "${fullPath}" -o "${outName}" && "${outName}"`;
    } else if (ext === '.cpp') {
        const outName = fullPath.replace('.cpp', '.exe');
        command = `g++ "${fullPath}" -o "${outName}" && "${outName}"`;
    } else if (ext === '.java') {
        // Java 11+ can run single files directly
        command = `java "${fullPath}"`;
    } else {
        return res.status(400).json({ error: 'Execution not supported for this file type via API. Run in terminal or preview directly.' });
    }

    exec(command, { cwd: WORKSPACE_DIR, timeout: 10000 }, (error, stdout, stderr) => {
        let output = '';
        if (error) {
            output += `Error: ${error.message}\n`;
        }
        if (stderr) {
            output += `Stderr: ${stderr}\n`;
        }
        output += stdout;
        res.json({ output });
    });
});

// 7. Download Workspace Zip
app.get('/api/download', (req, res) => {
    res.attachment('workspace.zip');
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    archive.on('error', (err) => {
        res.status(500).send({ error: err.message });
    });

    archive.pipe(res);
    archive.directory(WORKSPACE_DIR, false);
    archive.finalize();
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Code Genie Backend running on http://localhost:${PORT}`);
});
