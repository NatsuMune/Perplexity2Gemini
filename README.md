# Perplexity to Gemini (P2G)

A Chrome extension to seamlessly export your Perplexity AI chat history and organize your projects/threads into Google Gemini Notebooks (Gems).

## Features

- **100% Local & Private Processing**: Extraction runs entirely in your local browser session. No credentials or chat data are sent to external servers.
- **Perplexity Export**: Extracts all active threads and projects from Perplexity, generating a Google Takeout-compatible ZIP archive.
- **Gemini Notebook Automation**: Automatically recreates Perplexity Projects as Gemini Notebooks, applies project instructions, and assigns imported threads into their respective notebooks.
- **Resilient DOM Handling**: Handles Angular MDC selection states, modal lifecycles, and asynchronous element hydration smoothly.

## How to Use

### 1. Install Extension
1. Open Chrome / Brave / Chromium and navigate to `chrome://extensions`.
2. Enable **Developer mode** in the top right.
3. Click **Load unpacked** and select this directory (`Perplexity2Gemini`).

### 2. Extract from Perplexity
1. Navigate to [Perplexity.ai](https://www.perplexity.ai).
2. Click the **Perplexity to Gemini** extension icon in your toolbar.
3. Click **Start Extraction**.
4. Once completed, click **Download ZIP** to save your export file.

### 3. Import to Gemini
1. Navigate to [Gemini Settings -> Import memory to Gemini -> Import chats](https://gemini.google.com/import).
2. Upload the downloaded `.zip` file.
3. Confirm that the chats are imported into your Gemini Recents sidebar.

### 4. Migrate Projects to Notebooks
1. While on [Gemini](https://gemini.google.com), click the extension icon.
2. The popup will display your detected projects and threads.
3. Click **Start Migration**.
4. The extension will automatically create notebooks and move corresponding chats into them.

## Permissions

- `activeTab` & `tabs`: Detects active Perplexity and Gemini tabs to orchestrate extraction and migration.
- `scripting`: Executes automation scripts directly in the tab context.
- `storage`: Preserves project structure and metadata across extraction and migration steps.
- `downloads`: Saves the generated Takeout-compatible ZIP file.

## License

MIT
