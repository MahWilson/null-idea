import * as vscode from 'vscode';
import { DocumentManager } from './services/DocumentManager';
import { RAGService } from './services/RAGService';

export function activate(context: vscode.ExtensionContext) {
    console.log('CodeNection AI Docs Assistant is now active!');
    
    // Add debugging to see what's happening
    vscode.window.showInformationMessage('CodeNection AI Extension is activating...');
    
    try {

    // Initialize services
    const documentManager = new DocumentManager(context);
    const ragService = new RAGService(context);

    // Create output channel for AI responses
    const aiOutputChannel = vscode.window.createOutputChannel('CodeNection AI');
    context.subscriptions.push(aiOutputChannel);

    // Register a view container for the AI chat
    const aiChatProvider = vscode.window.registerWebviewViewProvider('codenection.aiChat', {
        resolveWebviewView(webviewView: vscode.WebviewView) {
            webviewView.webview.html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body { 
                            padding: 10px; 
                            font-family: var(--vscode-font-family);
                            color: var(--vscode-foreground);
                            background: var(--vscode-editor-background);
                        }
                        .chat-input { 
                            width: 100%; 
                            padding: 8px; 
                            margin: 5px 0; 
                            border: 1px solid var(--vscode-input-border);
                            background: var(--vscode-input-background);
                            color: var(--vscode-input-foreground);
                            border-radius: 4px;
                        }
                        .send-btn { 
                            width: 100%; 
                            padding: 8px; 
                            background: var(--vscode-button-background);
                            color: var(--vscode-button-foreground);
                            border: none; 
                            border-radius: 4px; 
                            cursor: pointer;
                        }
                        .send-btn:hover { 
                            background: var(--vscode-button-hoverBackground);
                        }
                        .chat-history { 
                            margin-top: 10px; 
                            max-height: 300px; 
                            overflow-y: auto;
                            border: 1px solid var(--vscode-panel-border);
                            padding: 10px;
                            background: var(--vscode-panel-background);
                        }
                    </style>
                </head>
                <body>
                    <h3>🤖 AI Chat</h3>
                    <input type="text" class="chat-input" id="chatInput" placeholder="Ask me anything...">
                    <button class="send-btn" id="sendBtn">Send</button>
                    <div class="chat-history" id="chatHistory"></div>
                    <script>
                        const vscode = acquireVsCodeApi();
                        const chatInput = document.getElementById('chatInput');
                        const sendBtn = document.getElementById('sendBtn');
                        const chatHistory = document.getElementById('chatHistory');
                        
                        function addMessage(content, isUser = false) {
                            const div = document.createElement('div');
                            div.style.margin = '5px 0';
                            div.style.padding = '5px';
                            div.style.borderRadius = '4px';
                            div.style.backgroundColor = isUser ? 'var(--vscode-button-background)' : 'var(--vscode-panel-background)';
                            div.style.color = isUser ? 'var(--vscode-button-foreground)' : 'var(--vscode-foreground)';
                            div.textContent = isUser ? '👤 ' + content : '🤖 ' + content;
                            chatHistory.appendChild(div);
                            chatHistory.scrollTop = chatHistory.scrollHeight;
                        }
                        
                        sendBtn.addEventListener('click', () => {
                            const message = chatInput.value.trim();
                            if (message) {
                                addMessage(message, true);
                                vscode.postMessage({ command: 'chat', message: message });
                                chatInput.value = '';
                            }
                        });
                        
                        chatInput.addEventListener('keypress', (e) => {
                            if (e.key === 'Enter') {
                                sendBtn.click();
                            }
                        });
                        
                        window.addEventListener('message', event => {
                            const message = event.data;
                            if (message.command === 'response') {
                                addMessage(message.content);
                            }
                        });
                    </script>
                </body>
                </html>
            `;

            // Handle messages from the webview
            webviewView.webview.onDidReceiveMessage(async (message) => {
                if (message.command === 'chat') {
                    try {
                        const context = await ragService.generateRAGContext(message.message);
                        const response = `Based on your question "${message.message}", here's what I found:\n\n${context.summary}`;
                        
                        webviewView.webview.postMessage({
                            command: 'response',
                            content: response
                        });
                    } catch (error) {
                        webviewView.webview.postMessage({
                            command: 'response',
                            content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
                        });
                    }
                }
            });
        }
    });
    context.subscriptions.push(aiChatProvider);

    // Register hover provider for inline AI insights
    const hoverProvider = vscode.languages.registerHoverProvider('*', {
        provideHover(document, position, token) {
            const range = document.getWordRangeAtPosition(position);
            if (range) {
                const word = document.getText(range);
                if (word.length > 3) { // Only show for words longer than 3 characters
                    const hoverMessage = new vscode.MarkdownString();
                    hoverMessage.appendMarkdown(`**🤖 AI Insight for "${word}"**\n\n`);
                    hoverMessage.appendMarkdown(`Click the AI Chat button in the status bar to ask questions about this term or get coding help!`);
                    
                    return new vscode.Hover(hoverMessage, range);
                }
            }
            return null;
        }
    });
    context.subscriptions.push(hoverProvider);



    // Create status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = '$(comment-discussion) AI Chat';
    statusBarItem.tooltip = 'Click to open AI chat';
    statusBarItem.command = 'codenection.openChat';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Register commands
    const openChatCommand = vscode.commands.registerCommand('codenection.openChat', () => {
        // Create a terminal-based chat interface
        const terminal = vscode.window.createTerminal('🤖 CodeNection AI Chat');
        terminal.show();
        
        // Send initial message to terminal
        terminal.sendText('echo "🤖 CodeNection AI Chat Ready!"');
        terminal.sendText('echo "Type your question and press Enter:"');
        terminal.sendText('echo ""');
        
        // Create a simple chat loop in the terminal
        const chatLoop = async () => {
            try {
                // Get user input from terminal
                const question = await vscode.window.showInputBox({
                    prompt: 'Ask me anything about your code or documentation:',
                    placeHolder: 'e.g., How do I implement authentication?',
                    ignoreFocusOut: true
                });
                
                if (question && question.trim()) {
                    // Show user question in terminal
                    terminal.sendText(`echo "👤 You: ${question}"`);
                    
                    try {
                        // Get AI response
                        const context = await ragService.generateRAGContext(question);
                        const response = `Based on your question "${question}", here's what I found:\n\n${context.summary}`;
                        
                        // Show AI response in terminal
                        terminal.sendText(`echo "🤖 AI: ${response}"`);
                        
                        if (context.relevantChunks.length > 0) {
                            terminal.sendText('echo ""');
                            terminal.sendText('echo "🔍 Relevant information:"');
                            context.relevantChunks.forEach((chunk, index) => {
                                terminal.sendText(`echo "  ${index + 1}. ${chunk.title}: ${chunk.content.substring(0, 100)}..."`);
                            });
                            
                            terminal.sendText('echo ""');
                            terminal.sendText('echo "💡 Suggested actions:"');
                            context.suggestedActions.forEach((action, index) => {
                                terminal.sendText(`echo "  • ${action}"`);
                            });
                        } else {
                            terminal.sendText('echo ""');
                            terminal.sendText('echo "❌ No relevant documentation found. Try uploading some documents first!"');
                        }
                        
                        terminal.sendText('echo ""');
                        terminal.sendText('echo "---"');
                        terminal.sendText('echo "Type another question or close the terminal to end chat."');
                        terminal.sendText('echo ""');
                        
                        // Continue chat loop
                        chatLoop();
                        
                    } catch (error) {
                        terminal.sendText(`echo "❌ AI Error: ${error instanceof Error ? error.message : 'Unknown error'}"`);
                        terminal.sendText('echo ""');
                        chatLoop();
                    }
                } else {
                    terminal.sendText('echo "Chat ended. Close the terminal or run the command again to restart."');
                }
            } catch (error) {
                terminal.sendText(`echo "❌ Chat Error: ${error instanceof Error ? error.message : 'Unknown error'}"`);
            }
        };
        
        // Start the chat loop
        chatLoop();
    });

    const uploadDocumentCommand = vscode.commands.registerCommand('codenection.uploadDocument', async (uri?: vscode.Uri) => {
        if (uri) {
            await documentManager.processDocument(uri);
            vscode.window.showInformationMessage(`Document processed: ${uri.fsPath}`);
        } else {
            const fileUris = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    'Documents': ['md', 'txt', 'pdf', 'docx']
                }
            });
            
            if (fileUris && fileUris.length > 0) {
                await documentManager.processDocument(fileUris[0]);
                vscode.window.showInformationMessage(`Document processed: ${fileUris[0].fsPath}`);
            }
        }
    });

    // Add context menu command for selected text
    const askAboutSelectionCommand = vscode.commands.registerCommand('codenection.askAboutSelection', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);
            
            if (selectedText.trim()) {
                // Create a quick input box for the selected text
                const question = await vscode.window.showInputBox({
                    prompt: `Ask about: "${selectedText.substring(0, 50)}${selectedText.length > 50 ? '...' : ''}"`,
                    placeHolder: 'e.g., What does this code do? How can I improve it?',
                    value: `What does this code do: ${selectedText}`
                });
                
                if (question) {
                    try {
                        const context = await ragService.generateRAGContext(question);
                        const response = `Based on your question about the selected code, here's what I found:\n\n${context.summary}`;
                        
                        if (context.relevantChunks.length > 0) {
                            aiOutputChannel.show();
                            aiOutputChannel.appendLine(`\n👤 You: ${question}`);
                            aiOutputChannel.appendLine(`🤖 AI: ${response}`);
                            aiOutputChannel.appendLine(`\n🔍 Relevant information:`);
                            context.relevantChunks.forEach((chunk, index) => {
                                aiOutputChannel.appendLine(`  ${index + 1}. ${chunk.title}: ${chunk.content.substring(0, 150)}...`);
                            });
                            
                            vscode.window.showInformationMessage(`AI Response Ready! Check the "CodeNection AI" output panel for details.`);
                        } else {
                            vscode.window.showInformationMessage(`AI: ${response}\n\nNo relevant documentation found. Try uploading some documents first!`);
                        }
                    } catch (error) {
                        vscode.window.showErrorMessage(`AI Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            } else {
                vscode.window.showWarningMessage('Please select some text first to ask about it.');
            }
        } else {
            vscode.window.showWarningMessage('Please open a text editor first.');
        }
    });

    const searchDocsCommand = vscode.commands.registerCommand('codenection.searchDocs', async () => {
        const query = await vscode.window.showInputBox({
            prompt: 'Enter your search query',
            placeHolder: 'e.g., How to implement authentication?'
        });

        if (query) {
            aiOutputChannel.show();
            aiOutputChannel.appendLine(`🔍 Searching for: "${query}"`);
            
            try {
                const results = await ragService.search(query);
                aiOutputChannel.appendLine(`📚 Found ${results.length} relevant documents:`);
                
                if (results.length > 0) {
                    results.forEach((result, index) => {
                        aiOutputChannel.appendLine(`  ${index + 1}. ${result.chunk.title} (Score: ${result.relevanceScore})`);
                        aiOutputChannel.appendLine(`     ${result.excerpt}`);
                    });
                } else {
                    aiOutputChannel.appendLine('   No relevant documents found.');
                }
            } catch (error) {
                aiOutputChannel.appendLine(`❌ Search error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            
            aiOutputChannel.appendLine(''); // Empty line for readability
        }
    });

    const configureAICommand = vscode.commands.registerCommand('codenection.configureAI', () => {
        // Show AI configuration in a simple way
        vscode.window.showInformationMessage('AI Configuration: Use VS Code settings to configure AI providers');
        
        // Open VS Code settings focused on CodeNection
        vscode.commands.executeCommand('workbench.action.openSettings', '@ext:codenection-ai-docs');
    });

    context.subscriptions.push(
        openChatCommand,
        uploadDocumentCommand,
        askAboutSelectionCommand,
        searchDocsCommand,
        configureAICommand
    );
    
    vscode.window.showInformationMessage('CodeNection AI Extension activated successfully! All commands registered.');
    
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to activate CodeNection AI Extension: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.error('Extension activation failed:', error);
    }
}

export function deactivate() {
    console.log('CodeNection AI Docs Assistant is now deactivated!');
} 