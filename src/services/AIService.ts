import { AIConfigManager, AIConfig } from '../config/ai-config';
import { DocumentChunk } from './DocumentManager';

export interface AIResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
  provider: string;
}

export interface AIPrompt {
  query: string;
  context: DocumentChunk[];
  systemPrompt?: string;
}

export class AIService {
  private readonly _configManager: AIConfigManager;
  private _config: AIConfig;

  constructor() {
    this._configManager = AIConfigManager.getInstance();
    this._config = this._configManager.getConfig();
  }

  public async generateResponse(prompt: AIPrompt): Promise<AIResponse> {
    // Always refresh config to get latest settings
    this._config = this._configManager.getConfig();

    try {
      switch (this._config.provider) {
        case 'openai':
          return await this._callOpenAI(prompt);
        case 'anthropic':
          return await this._callAnthropic(prompt);
        case 'local':
          return await this._callLocalModel(prompt);
        case 'mock':
        default:
          return await this._generateMockResponse(prompt);
      }
    } catch (error) {
      console.error('AI service error:', error);
      // Fallback to mock response on error
      return await this._generateMockResponse(prompt);
    }
  }

  private async _callOpenAI(prompt: AIPrompt): Promise<AIResponse> {
    if (!this._config.apiKey || !this._config.endpoint) {
      throw new Error('OpenAI configuration incomplete');
    }

    const systemPrompt = prompt.systemPrompt || 
      `You are a helpful coding assistant. Use the provided context to answer questions accurately. 
       If the context doesn't contain relevant information, say so rather than making things up.`;

    const contextText = prompt.context
      .map(chunk => `[${chunk.title}]: ${chunk.content}`)
      .join('\n\n');

    const fullPrompt = `${systemPrompt}\n\nContext:\n${contextText}\n\nQuestion: ${prompt.query}`;

    try {
      const response = await (globalThis as any).fetch(this._config.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this._config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this._config.model || 'gpt-4',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Context:\n${contextText}\n\nQuestion: ${prompt.query}` }
          ],
          max_tokens: this._config.maxTokens || 1000,
          temperature: this._config.temperature || 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        content: data.choices[0].message.content,
        usage: data.usage,
        model: data.model,
        provider: 'openai'
      };
    } catch (error) {
      console.error('OpenAI API call failed:', error);
      throw error;
    }
  }

  private async _callAnthropic(prompt: AIPrompt): Promise<AIResponse> {
    if (!this._config.apiKey || !this._config.endpoint) {
      throw new Error('Anthropic configuration incomplete');
    }

    const systemPrompt = prompt.systemPrompt || 
      `You are a helpful coding assistant. Use the provided context to answer questions accurately.`;

    const contextText = prompt.context
      .map(chunk => `[${chunk.title}]: ${chunk.content}`)
      .join('\n\n');

    try {
      const response = await (globalThis as any).fetch(this._config.endpoint, {
        method: 'POST',
        headers: {
          'x-api-key': this._config.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this._config.model || 'claude-3-sonnet-20240229',
          max_tokens: this._config.maxTokens || 1000,
          temperature: this._config.temperature || 0.7,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: `Context:\n${contextText}\n\nQuestion: ${prompt.query}`
            }
          ]
        }),
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        content: data.content[0].text,
        usage: {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens
        },
        model: data.model,
        provider: 'anthropic'
      };
    } catch (error) {
      console.error('Anthropic API call failed:', error);
      throw error;
    }
  }

  private async _callLocalModel(prompt: AIPrompt): Promise<AIResponse> {
    // Implementation for local models (Ollama, etc.)
    // This would connect to a local AI service
    throw new Error('Local model integration not yet implemented');
  }

  private async _generateMockResponse(prompt: AIPrompt): Promise<AIResponse> {
    // Safe fallback that doesn't make external calls
    const contextSummary = prompt.context.length > 0 
      ? `Based on ${prompt.context.length} document chunks, I found relevant information about: ${prompt.context.map(c => c.title).join(', ')}.`
      : 'I don\'t have any relevant documentation to reference for this question.';

    const mockResponse = `I understand you're asking about: "${prompt.query}". ${contextSummary}

This is a mock response from the development environment. To get real AI-powered answers:

1. Configure an AI provider in VS Code settings
2. Set your API key securely
3. Choose your preferred model

For now, here's what I found in your documents:
${prompt.context.map(chunk => `- ${chunk.title}: ${chunk.content.substring(0, 100)}...`).join('\n')}`;

    return {
      content: mockResponse,
      provider: 'mock'
    };
  }

  public isAIAvailable(): boolean {
    return this._configManager.isAIAvailable();
  }

  public getProvider(): string {
    return this._configManager.getProvider();
  }

  public async updateConfig(newConfig: Partial<AIConfig>): Promise<void> {
    await this._configManager.updateConfig(newConfig);
    this._config = this._configManager.getConfig();
  }
} 