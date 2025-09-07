import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('CodeNection AI Docs Assistant is now active!');
    
    // Show activation message
    vscode.window.showInformationMessage('CodeNection AI Extension is activating...');
    
    // Create output channel
    const aiOutputChannel = vscode.window.createOutputChannel('CodeNection AI');
    context.subscriptions.push(aiOutputChannel);
    
    // Create status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = '$(comment-discussion) AI Chat';
    statusBarItem.tooltip = 'Click to open AI chat';
    statusBarItem.command = 'codenection.openChat';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    
    // Simple chat command
    const openChatCommand = vscode.commands.registerCommand('codenection.openChat', () => {
        vscode.window.showInformationMessage('AI Chat button clicked!');
        
        // Create a simple terminal chat
        const terminal = vscode.window.createTerminal('🤖 CodeNection AI Chat');
        terminal.show();
        
        terminal.sendText('echo "🤖 CodeNection AI Chat Ready!"');
        terminal.sendText('echo "This is a test terminal to verify the extension is working."');
        terminal.sendText('echo "Type your question and press Enter:"');
        terminal.sendText('echo ""');
        
        // Simple input box
        vscode.window.showInputBox({
            prompt: 'Ask me anything:',
            placeHolder: 'e.g., How do I implement authentication?'
        }).then((question) => {
            if (question) {
                terminal.sendText(`echo "👤 You: ${question}"`);
                terminal.sendText(`echo "🤖 AI: This is a test response. Your question was: ${question}"`);
                terminal.sendText('echo "Extension is working! 🎉"');
            }
        });
    });
    
    // Upload document command
    const uploadDocumentCommand = vscode.commands.registerCommand('codenection.uploadDocument', () => {
        vscode.window.showInformationMessage('Upload Document command clicked!');
    });
    
    // Search docs command
    const searchDocsCommand = vscode.commands.registerCommand('codenection.searchDocs', () => {
        vscode.window.showInformationMessage('Search Documentation command clicked!');
    });
    
    // Configure AI command
    const configureAICommand = vscode.commands.registerCommand('codenection.configureAI', () => {
        vscode.window.showInformationMessage('Configure AI command clicked!');
    });
    
    // Ask about selection command
    const askAboutSelectionCommand = vscode.commands.registerCommand('codenection.askAboutSelection', () => {
        vscode.window.showInformationMessage('Ask AI About Selection command clicked!');
    });
    
    // Register all commands
    context.subscriptions.push(
        openChatCommand,
        uploadDocumentCommand,
        searchDocsCommand,
        configureAICommand,
        askAboutSelectionCommand
    );
    
    vscode.window.showInformationMessage('CodeNection AI Extension activated successfully! All commands registered.');
}

export function deactivate() {
    console.log('CodeNection AI Docs Assistant is now deactivated!');
}

