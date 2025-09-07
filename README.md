# 🚀 Documind AI – VS Code Extension

Documind is an AI-powered documentation assistant built as a VS Code extension. It analyzes your workspace to generate and maintain docs (README, API, Architecture, etc.), offers an in-editor AI chat with project context, tracks changes with diffs and Apply/Revert, and simulates maintenance workflows (PR suggestions, outdated docs, changelogs).

## 🧑‍⚖️ Quick Start 

1) Prerequisites: Node.js 18+, VS Code 1.74+, Git
2) Clone
```bash
git clone https://github.com/MahWilson/null-idea.git
cd null-idea
```
3) Install dependencies
```bash
npm install
cd webview && npm install && cd ..
```
4) Build
```bash
npm run compile
npm run webview:build
```
5) Run in VS Code (Debug F)
- Open this folder in VS Code
- Press F5 to launch the Extension Development Host (Documind loaded)

Optional: Package and install the .vsix
```bash
npm run extension:package
# In VS Code: Extensions → … → Install from VSIX → choose generated file
```

## ✨ Key Features
- Documentation generation: README, API, Architecture, Setup, Contributing, etc.
- Chat tab: keyword commands (explain/summarize/generate/regenerate), artificial “thinking” delay, file context management.
- Maintenance: simulated PR notifications, outdated docs detection, changelog actions.
- Activity log: diffs for all generated/modified files with Apply/Revert toggle buttons.
- UI/UX: floating file upload button with popup, responsive sizing, iOS-style toggles, animations.

## 📂 Project Structure
```
src/
  extension.ts              # Main extension entry & logic
  services/
    WorkspaceAnalyzer.ts    # Project/code analysis for docs
    DocumentationGenerator.ts# Content generation utilities
    MaintenanceService.ts   # Simulated PR/outdated/changelog notifications
    ChangeTracker.ts        # Change tracking, diffs, apply/revert
webview/
  src/                      # React components (Chat, Header, etc.)
  dist/                     # Built assets (after webview build)
```

## 🛠 Commands (in VS Code)
- “Documind: Open Chat” – opens the chat panel
- “Documind: Generate All Docs” – generates missing/outdated docs
- “Documind: Update Notifications” – refresh maintenance notifications

## 🔒 Security & Config
- No real API keys are required for the prototype; AI calls are stubbed/safe.
- `.gitignore` excludes `.env`, build artifacts, `.vsix`, and `node_modules`.

## 🧪 Development
```bash
npm run watch           # watch TypeScript changes
cd webview && npm run dev  # webview dev with hot reload
```

## 📄 License
MIT (see LICENSE)

---
Built for developer ergonomics: fast, in-editor workflows and explainable changes.
