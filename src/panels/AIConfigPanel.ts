import * as vscode from 'vscode';
import { AIConfigManager } from '../config/ai-config';

export class AIConfigPanel {
    public static currentPanel: AIConfigPanel | undefined;
    public static readonly viewType = 'codenectionAIConfig';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _configManager: AIConfigManager;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (AIConfigPanel.currentPanel) {
            AIConfigPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            AIConfigPanel.viewType,
            'CodeNection AI Configuration',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'webview', 'dist'),
                    vscode.Uri.joinPath(extensionUri, 'webview', 'public')
                ]
            }
        );

        AIConfigPanel.currentPanel = new AIConfigPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._configManager = AIConfigManager.getInstance();

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'updateConfig':
                        await this._handleConfigUpdate(message.config);
                        break;
                    case 'testConnection':
                        await this._handleTestConnection(message.config);
                        break;
                    case 'getCurrentConfig':
                        await this._sendCurrentConfig();
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    private async _handleConfigUpdate(config: any) {
        try {
            // Validate the configuration
            if (!this._validateConfig(config)) {
                this._panel.webview.postMessage({
                    command: 'configUpdateResult',
                    success: false,
                    error: 'Invalid configuration'
                });
                return;
            }

            // Update the configuration
            await this._configManager.updateConfig(config);
            
            this._panel.webview.postMessage({
                command: 'configUpdateResult',
                success: true
            });

            vscode.window.showInformationMessage('AI configuration updated successfully');
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'configUpdateResult',
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    private async _handleTestConnection(config: any) {
        try {
            // Create a temporary config for testing
            const testConfig = { ...config };
            
            // Test the connection based on provider
            let success = false;
            let error = '';

            switch (testConfig.provider) {
                case 'openai':
                    success = await this._testOpenAIConnection(testConfig);
                    break;
                case 'anthropic':
                    success = await this._testAnthropicConnection(testConfig);
                    break;
                case 'mock':
                    success = true;
                    break;
                default:
                    error = 'Unsupported provider';
            }

            this._panel.webview.postMessage({
                command: 'testConnectionResult',
                success,
                error
            });

            if (success) {
                vscode.window.showInformationMessage('AI connection test successful!');
            } else {
                vscode.window.showErrorMessage(`AI connection test failed: ${error}`);
            }
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'testConnectionResult',
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    private async _testOpenAIConnection(config: any): Promise<boolean> {
        if (!config.apiKey || !config.endpoint) {
            return false;
        }

        try {
            const response = await (globalThis as any).fetch(config.endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: config.model || 'gpt-4',
                    messages: [{ role: 'user', content: 'Hello' }],
                    max_tokens: 10,
                }),
            });

            return response.ok;
        } catch {
            return false;
        }
    }

    private async _testAnthropicConnection(config: any): Promise<boolean> {
        if (!config.apiKey || !config.endpoint) {
            return false;
        }

        try {
            const response = await (globalThis as any).fetch(config.endpoint, {
                method: 'POST',
                headers: {
                    'x-api-key': config.apiKey,
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: config.model || 'claude-3-sonnet-20240229',
                    max_tokens: 10,
                    messages: [{ role: 'user', content: 'Hello' }]
                }),
            });

            return response.ok;
        } catch {
            return false;
        }
    }

    private async _sendCurrentConfig() {
        const config = this._configManager.getConfig();
        this._panel.webview.postMessage({
            command: 'currentConfig',
            config: {
                provider: config.provider,
                model: config.model,
                temperature: config.temperature,
                maxTokens: config.maxTokens,
                // Don't send API keys for security
                hasApiKey: !!config.apiKey,
                hasEndpoint: !!config.endpoint
            }
        });
    }

    private _validateConfig(config: any): boolean {
        if (!config.provider || !['openai', 'anthropic', 'local', 'mock'].includes(config.provider)) {
            return false;
        }

        if (config.provider === 'mock') {
            return true; // Mock mode doesn't need additional validation
        }

        if (config.provider === 'openai' || config.provider === 'anthropic') {
            if (!config.apiKey || typeof config.apiKey !== 'string') {
                return false;
            }
            if (!config.endpoint || typeof config.endpoint !== 'string') {
                return false;
            }
        }

        if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 2)) {
            return false;
        }

        if (config.maxTokens !== undefined && (config.maxTokens < 1 || config.maxTokens > 4000)) {
            return false;
        }

        return true;
    }

    private _update() {
        const webview = this._panel.webview;
        this._panel.title = 'CodeNection AI Configuration';
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webview', 'dist', 'ai-config.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webview', 'dist', 'ai-config.css'));

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>AI Configuration</title>
                <link rel="stylesheet" type="text/css" href="${styleUri}">
            </head>
            <body>
                <div id="root">
                    <h2>AI Configuration</h2>
                    <p>This panel will be replaced with a React component for secure AI configuration.</p>
                    <p>For now, use VS Code settings to configure AI providers.</p>
                </div>
                <script src="${scriptUri}"></script>
            </body>
            </html>`;
    }

    public dispose() {
        AIConfigPanel.currentPanel = undefined;
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
} 