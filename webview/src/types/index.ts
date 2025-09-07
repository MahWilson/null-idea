export interface ChatMessage {
  id: string;
  type: 'user' | 'ai' | 'error';
  content: string;
  timestamp: Date;
  context?: any;
}

export interface DocumentInfo {
  id: string;
  title: string;
  source: string;
  fileType: string;
  createdAt: Date;
  metadata: {
    wordCount: number;
    chunkCount: number;
    tags?: string[];
  };
}

export interface SearchResult {
  chunk: {
    id: string;
    title: string;
    content: string;
    metadata: {
      source: string;
      fileType: string;
      tags?: string[];
    };
  };
  relevanceScore: number;
  excerpt: string;
}

export interface VSCodeMessage {
  command: string;
  [key: string]: any;
}

// Extend Window interface for VS Code webview
declare global {
  interface Window {
    vscode?: {
      postMessage(message: VSCodeMessage): void;
    };
  }
} 