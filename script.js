

        // --- Gemini AI Configuration ---
        const API_KEY = "";
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`;

        async function callGemini(prompt, retries = 3, delay = 1000) {
            try {
                const payload = {
                    contents: [{ parts: [{ text: prompt }] }],
                };
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    if (response.status === 429 && retries > 0) {
                        console.warn(`AI request throttled. Retrying in ${delay / 1000}s...`);
                        await new Promise(res => setTimeout(res, delay));
                        return callGemini(prompt, retries - 1, delay * 2);
                    }
                    throw new Error(`API Error: ${response.status} ${response.statusText}`);
                }

                const result = await response.json();
                const candidate = result.candidates?.[0];
                if (candidate && candidate.content?.parts?.[0]?.text) {
                    return candidate.content.parts[0].text;
                } else {
                    console.error("Unexpected API response structure:", result);
                    return "Error: Could not extract text from the AI response.";
                }
            } catch (error) {
                console.error('Error calling Gemini API:', error);
                return `An error occurred while contacting the AI assistant: ${error.message}`;
            }
        }

        // --- Code Editor Logic ---
        let files = JSON.parse(localStorage.getItem('codeEditorFiles')) || {
            'welcome.js': {
                content: '// Welcome to Code-Genie!\n'
                    + '// I can help you code faster.\n\n'
                    + 'function greet(name) {\n'
                    + '    return "Hello, " + name + "! Welcome to your AI code editor.";\n'
                    + '}\n\n'
                    + 'const message = greet("Developer");\n'
                    + 'console.log(message);\n\n'
                    + '// Try the "Generate Docs" button or ask the Chatbot a question!',
                language: 'javascript'
            }
        };

        let currentFile = 'welcome.js';

        
        let cmEditor;
        const codeEditor = document.getElementById('codeEditor');

        const fileList = document.getElementById('fileList');
        const gutter = document.getElementById('gutter');
        const localFileInput = document.getElementById('localFileInput');
        const outputPanel = document.getElementById('outputPanel');
        const outputContent = document.getElementById('outputContent');
        const aiChat = document.getElementById('aiChat');
        const aiChatBody = document.getElementById('aiChatBody');
        const aiInput = document.getElementById('aiInput');
        const sendAiBtn = document.getElementById('sendAiBtn');
        const closeChatBtn = document.getElementById('closeChatBtn');

        
        let workspaceMode = 'localstorage';
        let rootDirHandle = null;
        let fileSystemTree = [];
        let openFolders = new Set(); 

        function saveFilesToLocalStorage() {
            localStorage.setItem('codeEditorFiles', JSON.stringify(files));
        }
        
        async function openLocalFolder() {
            try {
                rootDirHandle = await window.showDirectoryPicker();
                workspaceMode = 'filesystem';
                showNotification(`Opened ${rootDirHandle.name}`, 'success');
                openFolders.clear();
                await refreshFileTree();
            } catch (err) {
                if (err.name !== 'AbortError') showNotification(err.message, 'error');
            }
        }

        async function refreshFileTree() {
            if (workspaceMode === 'filesystem') {
                fileSystemTree = await readDirRecursively(rootDirHandle, '');
                renderFileTree(fileSystemTree, fileList, '');
            } else {
                const tree = buildVirtualTree(files);
                renderFileTree(tree, fileList, '');
            }
        }

        async function readDirRecursively(dirHandle, path) {
            const entries = [];
            for await (const entry of dirHandle.values()) {
                if (entry.name === 'node_modules' || entry.name === '.git') continue;
                if (entry.kind === 'file') {
                    entries.push({ type: 'file', name: entry.name, path: path + entry.name, handle: entry });
                } else if (entry.kind === 'directory') {
                    const dirPath = path + entry.name + '/';
                    let children = [];
                    if (openFolders.has(dirPath)) {
                        children = await readDirRecursively(entry, dirPath);
                    }
                    entries.push({ type: 'folder', name: entry.name, path: dirPath, handle: entry, children });
                }
            }
            return entries.sort((a, b) => {
                if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
                return a.name.localeCompare(b.name);
            });
        }

        function buildVirtualTree(filesObj) {
            const root = { type: 'folder', name: 'root', path: '', children: [] };
            for (const path in filesObj) {
                const parts = path.split('/');
                let current = root;
                let currentPath = '';
                for (let i = 0; i < parts.length; i++) {
                    const part = parts[i];
                    currentPath += part + (i === parts.length - 1 ? '' : '/');
                    if (i === parts.length - 1) {
                        current.children.push({ type: 'file', name: part, path: currentPath });
                    } else {
                        let folder = current.children.find(c => c.name === part && c.type === 'folder');
                        if (!folder) {
                            folder = { type: 'folder', name: part, path: currentPath, children: [] };
                            current.children.push(folder);
                        }
                        current = folder;
                    }
                }
            }
            function sortNode(node) {
                if (node.children) {
                    node.children.sort((a, b) => {
                        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
                        return a.name.localeCompare(b.name);
                    });
                    node.children.forEach(sortNode);
                }
            }
            sortNode(root);
            return root.children;
        }

        function renderFileTree(nodes, container, currentPath) {
            container.innerHTML = '';
            container.className = 'tree-list';
            nodes.forEach(node => {
                const li = document.createElement('li');
                const itemDiv = document.createElement('div');
                itemDiv.className = 'tree-item' + (node.path === currentFile ? ' active' : '');
                
                if (node.type === 'folder') {
                    const isOpen = openFolders.has(node.path);
                    itemDiv.innerHTML = `
                        <svg class="tree-caret ${isOpen ? 'open' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                        <svg class="tree-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                        <span class="tree-item-name">${node.name}</span>
                    `;
                    itemDiv.addEventListener('click', () => {
                        if (isOpen) openFolders.delete(node.path);
                        else openFolders.add(node.path);
                        refreshFileTree();
                    });
                    li.appendChild(itemDiv);
                    
                    if (isOpen) {
                        const childUl = document.createElement('ul');
                        renderFileTree(node.children || [], childUl, node.path);
                        li.appendChild(childUl);
                    }
                } else {
                    itemDiv.innerHTML = `
                        <svg class="tree-caret hidden" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>
                        <svg class="tree-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                        <span class="tree-item-name">${node.name}</span>
                        <button class="delete-btn" title="Delete" style="margin-left:auto; background:none; border:none; color:var(--text-secondary); cursor:pointer;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    `;
                    itemDiv.addEventListener('click', (e) => {
                        if (e.target.closest('.delete-btn')) return;
                        loadFile(node.path, node.handle);
                    });
                    
                    const delBtn = itemDiv.querySelector('.delete-btn');
                    delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteFile(node.path, node.handle); });
                    
                    li.appendChild(itemDiv);
                }
                container.appendChild(li);
            });
        }

        async function getHandleByPath(dirHandle, path) {
            const parts = path.split('/');
            let current = dirHandle;
            for (let i = 0; i < parts.length; i++) {
                if (i === parts.length - 1) {
                    return await current.getFileHandle(parts[i]);
                } else {
                    current = await current.getDirectoryHandle(parts[i]);
                }
            }
            return null;
        }

        async function loadFile(filePath, handle = null) {
            if (currentFile && currentFile !== filePath) await saveFile(currentFile, true);
            currentFile = filePath;
            let content = '';
            let language = 'javascript';
            const ext = filePath.split('.').pop().toLowerCase();
            const langMap = { 'js': 'javascript', 'py': 'python', 'html': 'html', 'css': 'css', 'json': 'json', 'sql': 'sql', 'c': 'c', 'cpp': 'cpp', 'java': 'java' };
            language = langMap[ext] || 'javascript';

            if (workspaceMode === 'filesystem' && handle) {
                const fileData = await handle.getFile();
                content = await fileData.text();
            } else if (files[filePath]) {
                content = files[filePath].content;
            }

            if (typeof cmEditor !== 'undefined') {
                cmEditor.setValue(content);
                let mode = language;
                if (mode === 'html') mode = 'htmlmixed';
                cmEditor.setOption('mode', mode);
            } else {
                codeEditor.value = content;
            }
            document.getElementById('languageSelect').value = language;
            document.getElementById('currentFileName').textContent = filePath;
            updateStats();
            refreshFileTree();
        }

        async function saveFile(filePath = currentFile, silent = false) {
            if (!filePath) return;
            const content = typeof cmEditor !== 'undefined' ? cmEditor.getValue() : codeEditor.value;
            const language = document.getElementById('languageSelect').value;
            
            if (workspaceMode === 'filesystem') {
                try {
                    let handle = await getHandleByPath(rootDirHandle, filePath);
                    if (handle) {
                        const writable = await handle.createWritable();
                        await writable.write(content);
                        await writable.close();
                        if (!silent) showNotification(`Saved ${filePath} to disk`, 'success');
                    }
                } catch (e) {
                    if (!silent) showNotification(`Failed to save: ${e.message}`, 'error');
                }
            } else {
                files[filePath] = { content, language };
                saveFilesToLocalStorage();
                if (!silent) showNotification(`Saved ${filePath} locally`, 'success');
            }
        }

        async function createNewItem(isFolder) {
            const name = prompt(`Enter new ${isFolder ? 'folder' : 'file'} name (can include path like src/app.js):`);
            if (!name) return;
            
            if (workspaceMode === 'filesystem') {
                try {
                    const parts = name.split('/');
                    let current = rootDirHandle;
                    let currentPath = '';
                    for (let i = 0; i < parts.length; i++) {
                        currentPath += parts[i] + (i === parts.length - 1 ? (isFolder ? '/' : '') : '/');
                        if (i === parts.length - 1) {
                            if (isFolder) {
                                await current.getDirectoryHandle(parts[i], { create: true });
                            } else {
                                await current.getFileHandle(parts[i], { create: true });
                            }
                        } else {
                            current = await current.getDirectoryHandle(parts[i], { create: true });
                            openFolders.add(currentPath);
                        }
                    }
                    await refreshFileTree();
                    if (!isFolder) loadFile(name);
                } catch (e) {
                    showNotification(`Error creating: ${e.message}`, 'error');
                }
            } else {
                if (isFolder) {
                    const dummyPath = name + '/.keep';
                    files[dummyPath] = { content: '// Keep folder', language: 'javascript' };
                    openFolders.add(name + '/');
                    saveFilesToLocalStorage();
                    refreshFileTree();
                } else {
                    const ext = name.split('.').pop().toLowerCase();
                    const langMap = { 'js': 'javascript', 'py': 'python', 'html': 'html', 'css': 'css', 'json': 'json' };
                    files[name] = { content: `// New file: ${name}`, language: langMap[ext] || 'javascript' };
                    saveFilesToLocalStorage();
                    const parts = name.split('/');
                    let p = '';
                    for(let i=0; i<parts.length-1; i++){
                        p += parts[i] + '/';
                        openFolders.add(p);
                    }
                    await refreshFileTree();
                    loadFile(name);
                }
            }
        }

        async function deleteFile(filePath, handle = null) {
            if (!confirm(`Delete ${filePath}?`)) return;
            
            if (workspaceMode === 'filesystem') {
                try {
                    const parts = filePath.split('/');
                    const name = parts.pop();
                    let current = rootDirHandle;
                    for (const part of parts) {
                        current = await current.getDirectoryHandle(part);
                    }
                    await current.removeEntry(name);
                    if (currentFile === filePath) {
                        currentFile = null;
                        if(typeof cmEditor!=='undefined') cmEditor.setValue('');
                    }
                    await refreshFileTree();
                    showNotification(`Deleted ${filePath}`, 'success');
                } catch (e) {
                    showNotification(`Error deleting: ${e.message}`, 'error');
                }
            } else {
                delete files[filePath];
                saveFilesToLocalStorage();
                if (currentFile === filePath) {
                    const remaining = Object.keys(files);
                    if (remaining.length > 0) loadFile(remaining[0]);
                    else { currentFile = null; if(typeof cmEditor!=='undefined') cmEditor.setValue(''); }
                }
                refreshFileTree();
            }
        }

        function updateStats() {
            const content = typeof cmEditor !== 'undefined' ? cmEditor.getValue() : codeEditor.value;
            const lines = content.split('\n').length;
            const chars = content.length;
            document.getElementById('lineCount').textContent = lines;
            document.getElementById('charCount').textContent = chars;
        }

        function renderLineNumbers() { return; }

        function changeLanguage() {
            const lang = document.getElementById('languageSelect').value;
            document.getElementById('currentLang').textContent = lang.charAt(0).toUpperCase() + lang.slice(1);
            if (files[currentFile] && workspaceMode === 'localstorage') {
                files[currentFile].language = lang;
                saveFilesToLocalStorage();
            }
        }

        function showNotification(message, type = 'success') {
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.textContent = message;
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 3000);
        }

async function autofixError(code, errorMessage) {
            const prompt = `The following JavaScript code produced an error. Explain the error and provide the corrected code.
            \n--- CODE ---\n${code}
            \n--- ERROR ---\n${errorMessage}
            \n--- RESPONSE ---\n**Explanation:**\n[Your explanation]\n\n**Corrected Code:**\n\`\`\`javascript\n[Corrected code]\n\`\`\``;
            appendChat('assistant', 'An error was detected. Analyzing...');
            toggleChat();
            const fixSuggestion = await callGemini(prompt);
            appendChat('assistant', fixSuggestion);
        }

        function runCode() {
            const code = typeof cmEditor !== 'undefined' ? cmEditor.getValue() : codeEditor.value;
            const language = document.getElementById('languageSelect').value;
            openOutput();
            clearOutput();

            if (language === 'html') {
                const frame = document.getElementById('previewFrame');
                if (frame && frame.classList.contains('open')) {
                    frame.srcdoc = code;
                    showNotification('Preview updated', 'success');
                } else {
                    const newWindow = window.open();
                    newWindow.document.write(code);
                }
                return;
            }
            if (language === 'javascript') {
                const originalConsole = { log: console.log, error: console.error, warn: console.warn };
                try {
                    appendOutput('--- Running JavaScript ---', 'meta');
                    console.log = (...args) => appendOutput(args.join(' '), 'log');
                    console.error = (...args) => appendOutput(args.join(' '), 'error');
                    console.warn = (...args) => appendOutput(args.join(' '), 'warn');
                    eval(code);
                    appendOutput('--- Execution finished ---', 'meta');
                } catch (error) {
                    appendOutput(error.message || String(error), 'error');
                    showNotification('Error detected!', 'error');
                    autofixError(code, error.message);
                } finally {
                    console.log = originalConsole.log;
                    console.error = originalConsole.error;
                    console.warn = originalConsole.warn;
                }

            } else {
                appendOutput(`Running ${language} is not supported in the browser.`, 'warn');
            }
        }

        function appendOutput(text, type = 'log') {
            const line = document.createElement('div');
            line.className = `output-line output-${type}`;
            line.textContent = text;
            outputContent.appendChild(line);
            outputContent.scrollTop = outputContent.scrollHeight;
        }

        function appendChat(role, text) {
            const el = document.createElement('div');
            el.className = `chat-line chat-${role}`;
            const formattedText = text
                .replace(/```(javascript|js|html|css|python)?\n([\s\S]*?)```/g, (match, lang, code) => `<pre><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`)
                .replace(/`([^`]+)`/g, '<code>$1</code>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br>');
            el.innerHTML = formattedText;
            aiChatBody.appendChild(el);
            aiChatBody.scrollTop = aiChatBody.scrollHeight;
        }

        function clearOutput() { if (outputContent) outputContent.innerHTML = ''; }
        function openOutput() { if (outputPanel) outputPanel.classList.add('open'); }
        function toggleOutput() { if (outputPanel) outputPanel.classList.toggle('open'); }
        function toggleChat() { if (aiChat) aiChat.setAttribute('aria-hidden', aiChat.getAttribute('aria-hidden') === 'false' ? 'true' : 'false'); }

        async function generateDocumentation() {
            if (!currentFile || !files[currentFile]) {
                showNotification('No file to document', 'error');
                return;
            }
            const code = typeof cmEditor !== 'undefined' ? cmEditor.getValue() : codeEditor.value;
            if (!code.trim()) {
                showNotification('Cannot document an empty file', 'error');
                return;
            }
            const language = files[currentFile].language;
            const prompt = `Generate technical documentation in Markdown for the following ${language} code. Describe its purpose, functions, and usage.\n\n---\n\n${code}`;
            showNotification('Generating documentation...', 'success');
            openOutput();
            clearOutput();
            appendOutput('--- Generating Documentation (AI) ---', 'meta');
            const documentation = await callGemini(prompt);
            clearOutput();
            appendOutput('--- AI Generated Documentation ---', 'meta');
            const docElement = document.createElement('div');
            docElement.className = 'output-line';
            docElement.innerHTML = documentation
                .replace(/### (.*)/g, '<h3>$1</h3>')
                .replace(/## (.*)/g, '<h2>$1</h2>')
                .replace(/`([^`]+)`/g, '<code>$1</code>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/^- (.*)/gm, '<li>$1</li>')
                .replace(/\n/g, '<br>');
            outputContent.appendChild(docElement);
        }

        document.addEventListener('DOMContentLoaded', () => {
            cmEditor = CodeMirror.fromTextArea(document.getElementById('codeEditor'), {
                lineNumbers: true,
                theme: 'dracula',
                mode: 'javascript',
                indentUnit: 4,
            });
            cmEditor.on('change', () => {
                updateStats();
                if (currentFile && files[currentFile]) {
                    files[currentFile].content = cmEditor.getValue();
                }
                // Live web preview update if open
                const previewFrame = document.getElementById('previewFrame');
                if (previewFrame && previewFrame.classList.contains('open') && ['html', 'css', 'javascript'].includes(files[currentFile].language)) {
                    // Update preview content smartly or just wait for manual run. Actually, let's keep it manual run or simple debounce.
                }
            });
            
            // New Buttons Event Listeners
            const exportProjectBtn = document.getElementById('exportProjectBtn');
            if (exportProjectBtn) {
                exportProjectBtn.addEventListener('click', async () => {
                    if (typeof JSZip === 'undefined') return showNotification('JSZip not loaded', 'error');
                    const zip = new JSZip();
                    for (const [name, data] of Object.entries(files)) {
                        zip.file(name, data.content);
                    }
                    const content = await zip.generateAsync({type:"blob"});
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(content);
                    a.download = "CodeGenie_Project.zip";
                    a.click();
                    showNotification('Project exported successfully', 'success');
                });
            }

            const togglePreviewBtn = document.getElementById('togglePreviewBtn');
            if (togglePreviewBtn) {
                togglePreviewBtn.addEventListener('click', () => {
                    const frame = document.getElementById('previewFrame');
                    frame.classList.toggle('open');
                    if (frame.classList.contains('open')) {
                        runCode(); // render immediately
                    }
                });
            }

            const explainCodeBtn = document.getElementById('explainCodeBtn');
            if (explainCodeBtn) {
                explainCodeBtn.addEventListener('click', async () => {
                    const code = cmEditor.getValue();
                    if (!code.trim()) return showNotification('No code to explain', 'error');
                    toggleChat(); // open chat
                    appendChat('user', 'Please explain this code.');
                    const prompt = `Explain the following code:\n\n\`\`\`\n${code}\n\`\`\``;
                    const thinking = document.createElement('div');
                    thinking.className = 'chat-line chat-assistant';
                    thinking.textContent = 'Thinking...';
                    aiChatBody.appendChild(thinking);
                    aiChatBody.scrollTop = aiChatBody.scrollHeight;
                    const reply = await callGemini(prompt);
                    thinking.remove();
                    appendChat('assistant', reply);
                });
            }
            
            const findBugsBtn = document.getElementById('findBugsBtn');
            if (findBugsBtn) {
                findBugsBtn.addEventListener('click', async () => {
                    const code = cmEditor.getValue();
                    if (!code.trim()) return showNotification('No code to analyze', 'error');
                    toggleChat(); // open chat
                    appendChat('user', 'Please find bugs in this code.');
                    const prompt = `Analyze the following code for bugs, vulnerabilities, or anti-patterns and provide fixes:\n\n\`\`\`\n${code}\n\`\`\``;
                    const thinking = document.createElement('div');
                    thinking.className = 'chat-line chat-assistant';
                    thinking.textContent = 'Thinking...';
                    aiChatBody.appendChild(thinking);
                    aiChatBody.scrollTop = aiChatBody.scrollHeight;
                    const reply = await callGemini(prompt);
                    thinking.remove();
                    appendChat('assistant', reply);
                });
            }

            document.getElementById('importLocalBtn').addEventListener('click', () => document.getElementById('localFileInput').click());
            document.getElementById('saveBtn').addEventListener('click', saveFile);
            document.getElementById('runBtn').addEventListener('click', runCode);
            document.getElementById('exportBtn').addEventListener('click', exportCurrentFile);
            document.getElementById('toggleOutputBtn').addEventListener('click', toggleOutput);
            document.getElementById('toggleChatBtn').addEventListener('click', toggleChat);
            document.getElementById('generateDocsBtn').addEventListener('click', generateDocumentation);
            document.getElementById('clearOutputBtn').addEventListener('click', clearOutput);
            if (closeChatBtn) closeChatBtn.addEventListener('click', () => aiChat.setAttribute('aria-hidden', 'true'));
            if (sendAiBtn) sendAiBtn.addEventListener('click', async () => {
                const text = aiInput.value.trim();
                if (!text) return;
                appendChat('user', text);
                aiInput.value = '';
                const codeContext = typeof cmEditor !== 'undefined' ? cmEditor.getValue() : codeEditor.value;
                const prompt = `User question: ${text}\n\nCode context:\n${codeContext}`;
                const thinking = document.createElement('div');
                thinking.className = 'chat-line chat-assistant';
                thinking.textContent = 'Thinking...';
                aiChatBody.appendChild(thinking);
                aiChatBody.scrollTop = aiChatBody.scrollHeight;
                const reply = await callGemini(prompt);
                thinking.remove();
                appendChat('assistant', reply);
            });
            
            
            document.querySelector('#compileModal .btn-outline').addEventListener('click', () => document.getElementById('compileModal').classList.remove('active'));
            document.getElementById('localFileInput').addEventListener('change', handleLocalFileSelect);
            document.getElementById('languageSelect').addEventListener('change', changeLanguage);
            codeEditor.addEventListener('input', () => { updateStats(); renderLineNumbers(); });
            codeEditor.addEventListener('scroll', () => { if (gutter) gutter.scrollTop = codeEditor.scrollTop; });
            document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveFile(); } });

            
            const newFileBtn = document.getElementById('newFileBtn');
            if (newFileBtn) newFileBtn.addEventListener('click', () => createNewItem(false));
            
            const newFolderBtn = document.getElementById('newFolderBtn');
            if (newFolderBtn) newFolderBtn.addEventListener('click', () => createNewItem(true));
            
            const openFolderBtn = document.getElementById('openFolderBtn');
            if (openFolderBtn) openFolderBtn.addEventListener('click', openLocalFolder);

            refreshFileTree();
            if (currentFile && files[currentFile]) {
                loadFile(currentFile, files[currentFile].language);
            }
        });

        function handleLocalFileSelect(e) {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(evt) {
                const content = evt.target.result;
                const filename = file.name;
                if (files[filename] && !confirm(`${filename} already exists. Overwrite?`)) {
                    localFileInput.value = '';
                    return;
                }
                const lang = filename.split('.').pop().toLowerCase();
                const langMap = { 'js': 'javascript', 'py': 'python', 'html': 'html', 'css': 'css', 'json': 'json', 'sql': 'sql', 'c': 'c', 'cpp': 'cpp', 'java': 'java' };
                files[filename] = { content, language: langMap[lang] || 'javascript' };
                saveFilesToLocalStorage();
                refreshFileTree();
                loadFile(filename, files[filename].language);
                showNotification(`Imported ${filename}`, 'success');
                localFileInput.value = '';
            };
            reader.readAsText(file);
        }

        function exportCurrentFile() {
            if (!currentFile || !files[currentFile]) {
                showNotification('No file to export', 'error');
                return;
            }
            const content = files[currentFile].content || codeEditor.value || '';
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = currentFile;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            showNotification(`Exported ${currentFile}`, 'success');
        }
    