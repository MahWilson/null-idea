import * as vscode from 'vscode';
import { AIService } from '../services/AIService';
import { DocumentManager } from '../services/DocumentManager';
import { RAGService } from '../services/RAGService';

export class ChatPanel {
    public static currentPanel: ChatPanel | undefined;
    public static readonly viewType = 'codenectionChat';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _documentManager: DocumentManager;
    private readonly _ragService: RAGService;
    private readonly _aiService: AIService;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri, documentManager: DocumentManager, ragService: RAGService) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (ChatPanel.currentPanel) {
            ChatPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            ChatPanel.viewType,
            'Documind AI',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'webview', 'dist'),
                    vscode.Uri.joinPath(extensionUri, 'webview', 'public')
                ]
            }
        );

        const aiService = new AIService();
        ChatPanel.currentPanel = new ChatPanel(panel, extensionUri, documentManager, ragService, aiService);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, documentManager: DocumentManager, ragService: RAGService, aiService: AIService) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._documentManager = documentManager;
        this._ragService = ragService;
        this._aiService = aiService;

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'chat':
                        await this._handleChatMessage(message.text);
                        break;
                    case 'uploadDocument':
                        await this._handleDocumentUpload(message.uri);
                        break;
                    case 'searchDocs':
                        await this._handleSearchQuery(message.query);
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    private async _handleChatMessage(text: string) {
        try {
            // Get relevant context from RAG service
            const context = await this._ragService.getRelevantContext(text);
            
            // Use AI service for response generation
            const aiResponse = await this._aiService.generateResponse({
                query: text,
                context: context
            });
            
            this._panel.webview.postMessage({
                command: 'chatResponse',
                response: aiResponse.content,
                context,
                aiInfo: {
                    provider: aiResponse.provider,
                    model: aiResponse.model,
                    usage: aiResponse.usage
                }
            });
        } catch (error) {
            console.error('Chat message handling error:', error);
            this._panel.webview.postMessage({
                command: 'error',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    private async _handleDocumentUpload(uri: string) {
        try {
            const vscodeUri = vscode.Uri.parse(uri);
            await this._documentManager.processDocument(vscodeUri);
            
            this._panel.webview.postMessage({
                command: 'documentUploaded',
                success: true
            });
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'error',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    private async _handleSearchQuery(query: string) {
        try {
            const results = await this._ragService.search(query);
            
            this._panel.webview.postMessage({
                command: 'searchResults',
                results
            });
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'error',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    // Removed _generateAIResponse method as it's now handled by AIService

    private _update() {
        const webview = this._panel.webview;
        this._panel.title = 'Documind AI';
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webview', 'dist', 'index.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webview', 'dist', 'index.css'));

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Documind AI</title>
                <link rel="stylesheet" type="text/css" href="${styleUri}">
            </head>
            <body>
                <div id="root"></div>
                <script src="${scriptUri}"></script>
            </body>
            </html>`;
    }

    public dispose() {
        ChatPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
} 