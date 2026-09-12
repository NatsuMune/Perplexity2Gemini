# Privacy Policy for Perplexity to Gemini Exporter

**Last updated:** September 3, 2026

## Overview
Perplexity to Gemini Exporter ("the Extension") is designed to help users export their Perplexity AI chat history and organize their threads and projects into Google Gemini Notebooks.

We prioritize your privacy. The Extension does **not** collect, sell, or transmit any personal data, conversation history, or credentials to external servers.

---

## Data Handled by the Extension

1. **Perplexity Chat History & Projects**:
   - The Extension accesses conversation titles, messages, project names, and project instructions solely within your active browser session on `perplexity.ai`.
   - This data is used exclusively to generate a local `.zip` file on your device and to map projects during migration.
   
2. **Google Gemini Interface**:
   - The Extension interacts with `gemini.google.com` solely to assist in creating Gemini Notebooks and organizing imported threads, based on your initiated action.

3. **Browser Storage (`chrome.storage.local`)**:
   - The Extension uses local browser storage to temporarily hold project and thread identifiers between the extraction and migration steps on your local device.

---

## 100% Local Processing

- **No Remote Servers**: The Extension does not operate any analytics, tracking, or remote backend servers.
- **No Third-Party Sharing**: None of your data or chat transcripts are shared with, sold to, or accessible by the developers or any third parties.
- **Local Downloads**: All exported files are generated client-side using JavaScript (`JSZip`) and saved directly to your local computer's download folder.

---

## Permissions Usage

- `activeTab` / `tabs`: Used to detect your active Perplexity or Gemini tab and coordinate the export and migration process.
- `scripting`: Used to run extraction logic locally in the Perplexity tab and automation in the Gemini tab.
- `storage`: Used to preserve project structure and metadata temporarily across extraction and migration.
- `downloads`: Used to save the generated Takeout-compatible ZIP file directly to your device.
- `host_permissions` (`*://*.perplexity.ai/*`, `*://gemini.google.com/*`): Required to read chats from Perplexity and organize notebooks in Gemini.

---

## Changes to this Policy
If changes are made to this Privacy Policy, the updated policy will be posted on this page with an updated revision date.

## Contact
If you have any questions about this Privacy Policy, please open an issue on the project's GitHub repository.
