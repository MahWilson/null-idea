import * as vscode from 'vscode';

export interface AIConfig {
  provider: 'openai' | 'anthropic' | 'local' | 'mock';
  apiKey?: string;
  endpoint?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export class AIConfigManager {
  private static instance: AIConfigManager;
  private _config: AIConfig;

  private constructor() {
    this._config = this._loadConfig();
  }

  public static getInstance(): AIConfigManager {
    if (!AIConfigManager.instance) {
      AIConfigManager.instance = new AIConfigManager();
    }
    return AIConfigManager.instance;
  }

  public getConfig(): AIConfig {
    return { ...this._config };
  }

  public async updateConfig(newConfig: Partial<AIConfig>): Promise<void> {
    this._config = { ...this._config, ...newConfig };
    await this._saveConfig();
  }

  public isAIAvailable(): boolean {
    if (this._config.provider === 'mock') return true;
    if (this._config.provider === 'local') return true;
    
    return !!(this._config.apiKey && this._config.endpoint);
  }

  public getProvider(): string {
    return this._config.provider;
  }

  private _loadConfig(): AIConfig {
    // Default to mock mode for safety
    const defaultConfig: AIConfig = {
      provider: 'mock',
      temperature: 0.7,
      maxTokens: 1000
    };

    try {
      // Try to load from VS Code workspace settings
      const workspaceConfig = vscode.workspace.getConfiguration('codenection.ai');
      
      if (workspaceConfig.has('provider')) {
        const provider = workspaceConfig.get('provider') as string;
        if (['openai', 'anthropic', 'local', 'mock'].includes(provider)) {
          defaultConfig.provider = provider as any;
        }
      }

      // Only load sensitive data if explicitly configured
      if (workspaceConfig.has('apiKey') && workspaceConfig.get('apiKey')) {
        defaultConfig.apiKey = workspaceConfig.get('apiKey') as string;
      }

      if (workspaceConfig.has('endpoint') && workspaceConfig.get('endpoint')) {
        defaultConfig.endpoint = workspaceConfig.get('endpoint') as string;
      }

      if (workspaceConfig.has('model') && workspaceConfig.get('model')) {
        defaultConfig.model = workspaceConfig.get('model') as string;
      }

      if (workspaceConfig.has('temperature')) {
        defaultConfig.temperature = workspaceConfig.get('temperature') as number;
      }

      if (workspaceConfig.has('maxTokens')) {
        defaultConfig.maxTokens = workspaceConfig.get('maxTokens') as number;
      }

    } catch (error) {
      console.warn('Failed to load AI configuration, using defaults:', error);
    }

    return defaultConfig;
  }

  private async _saveConfig(): Promise<void> {
    try {
      const workspaceConfig = vscode.workspace.getConfiguration('codenection.ai');
      
      // Only save non-sensitive configuration
      await workspaceConfig.update('provider', this._config.provider, vscode.ConfigurationTarget.Workspace);
      await workspaceConfig.update('model', this._config.model, vscode.ConfigurationTarget.Workspace);
      await workspaceConfig.update('temperature', this._config.temperature, vscode.ConfigurationTarget.Workspace);
      await workspaceConfig.update('maxTokens', this._config.maxTokens, vscode.ConfigurationTarget.Workspace);
      
      // Don't save API keys to workspace settings for security
      // API keys should be set via environment variables or secure input
    } catch (error) {
      console.error('Failed to save AI configuration:', error);
    }
  }
} 