# 🚀 CodeNection AI Extension - Development Guide

## 🎯 **Development Workflow**

### **Goal: Test with Real Projects While Developing**

You want to use this extension on any codebase, so you need to test it with real projects during development.

## 🛠️ **Option 1: Multi-Root Workspace (Recommended)**

### **Step 1: Create Multi-Root Workspace**
1. **File** → **Add Folder to Workspace**
2. **Add your extension project** (current folder)
3. **Add a real project** you want to test with
4. **Save Workspace As** → `codenection-dev.code-workspace`

### **Step 2: Test Your Extension**
1. **Press F5** → Extension Development Host opens
2. **In the new window**, you'll see both projects
3. **Test your extension** on the real project code
4. **Make changes** to extension → **Reload Window** to test

### **Step 3: Iterate Quickly**
- **Edit extension code** in one project
- **Test on real project** in same workspace
- **No need to package/install** during development

## 🔧 **Option 2: Package & Install During Development**

### **Step 1: Package Extension**
```bash
npm install -g vsce
vsce package
```

### **Step 2: Install Locally**
1. **Extensions panel** → **Install from VSIX**
2. **Select your .vsix file**
3. **Test with real projects**

### **Step 3: Update During Development**
1. **Make changes** to extension
2. **Package again** → `vsce package`
3. **Uninstall old version**
4. **Install new .vsix file**

## 🧪 **Option 3: Extension Development Host with Real Projects**

### **Step 1: Launch Extension Development Host**
1. **Press F5** → New window opens
2. **Open a real project** in that window
3. **Test your extension** on real code

### **Step 2: Test Features**
- **AI Chat button** in status bar
- **Hover over code** for AI insights
- **Right-click selected text** → "Ask AI About Selection"
- **Command Palette** → "CodeNection" commands

## 🎯 **Recommended Development Setup**

### **Use Option 1 (Multi-Root Workspace) because:**
- ✅ **Fastest iteration** - no packaging/installing
- ✅ **Real project testing** - see actual use cases
- ✅ **Immediate feedback** - changes appear instantly
- ✅ **Professional workflow** - how real extension developers work

### **Your Workspace Structure:**
```
codenection-dev.code-workspace
├── codenection-extension/          (your extension project)
├── real-project-1/                 (test project)
├── real-project-2/                 (another test project)
└── any-other-project/              (more test projects)
```

## 🚀 **Quick Start for Testing**

1. **Press F5** → Extension Development Host opens
2. **Add a real project folder** to the new window
3. **Test your AI features** on real code:
   - Click **AI Chat** button → Should show pop-down input
   - **Hover over code** → Should show AI tooltips
   - **Select text** → Right-click → "Ask AI About Selection"
4. **Make changes** to extension code
5. **Reload Window** (`Ctrl+Shift+P` → "Developer: Reload Window")
6. **Test again** with real project

## 🔍 **What to Look For**

### **✅ Working Correctly:**
- **Pop-down input boxes** (not new windows)
- **Hover tooltips** over code
- **Context menu** options
- **Status bar** AI Chat button

### **❌ Not Working:**
- **Separate windows** opening (except Extension Development Host)
- **Commands not found** in Command Palette
- **UI elements not appearing**

## 🎉 **You're Ready to Develop!**

This setup gives you the best of both worlds:
- **Fast development** with immediate testing
- **Real project validation** of your features
- **Professional workflow** for extension development

Start with Option 1 and you'll be testing your extension on real codebases in no time! 🚀
