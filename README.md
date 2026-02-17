# Code-Genie 🧞‍♂️

An AI-powered code editor and compiler capable of generating code, documentation, and executing code in multiple languages.

## 🚀 How to Run

Since this is a client-side web application, you don't need to install any servers or dependencies.

1.  **Open `index.html`** in any modern web browser (Chrome, Edge, Firefox, etc.).
    *   Simply double-click the file or drag it into your browser window.

## 🌐 How to Host (Deploy Online)

Since Code-Genie is a static site (HTML/CSS/JS only), you can host it for free on many platforms.

### Option 1: Netlify (Easiest - Drag & Drop)
1.  Go to [Netlify Drop](https://app.netlify.com/drop).
2.  Drag the **folder** containing `index.html` into the dashed box.
3.  Netlify will upload it and give you a live URL (e.g., `https://peaceful-name-12345.netlify.app`).
4.  You can share this link with anyone!

### Option 2: GitHub Pages (Best for Version Control)
1.  Create a new repository on [GitHub](https://github.com/new).
2.  Upload the `index.html` file to the repository.
3.  Go to **Settings** > **Pages**.
4.  Under **Source**, select `main` (or `master`) branch.
5.  Click **Save**. GitHub will generate a link for you (e.g., `https://yourusername.github.io/repo-name`).

### Option 3: Vercel
1.  Install Vercel CLI: `npm i -g vercel` (requires Node.js).
2.  Run `vercel` in the project folder.
3.  Follow the prompts to deploy instantly.

## 🔑 Setup API Keys

To use the AI features (Gemini) and Code Execution (Judge0), you need to configure your API keys.

1.  Click the **⚙️ Settings** button in the top right corner of the app.
2.  Enter your **Gemini API Key**.
    *   [Get a free Gemini API Key here](https://aistudio.google.com/app/apikey)
3.  Enter your **Judge0 API Key**.
    *   Subscribe to the [Judge0 CE API on RapidAPI](https://rapidapi.com/judge0-official/api/judge0-ce) (Basic plan is free).
4.  Click **Save Settings**.
    *   Your keys are saved securely in your browser's Local Storage. They never leave your device except to call the APIs.

## ✨ Features

-   **AI Assistant**: Chat with Gemini to generate code, debug, or ask questions.
-   **Multi-language Support**: JavaScript, Python, C, C++, Java, etc.
-   **Code Execution**: Compile and run code directly in the browser (via Judge0).
-   **File Management**: Create, edit, save, and delete files locally.
-   **Documentation Generator**: Auto-generate documentation for your code.
