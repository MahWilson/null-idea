import { FileText, MessageSquare, Upload } from 'lucide-react';
import React from 'react';

interface HeaderProps {
  activeView: 'chat' | 'docs';
  onViewChange: (view: 'chat' | 'docs') => void;
  onUploadDocument: () => void;
}

export function Header({ activeView, onViewChange, onUploadDocument }: HeaderProps) {
  return (
    <header className="bg-background-secondary border-b border-border-primary px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <h1 className="text-xl font-bold text-foreground-primary">
            Documind
          </h1>
          
          <nav className="flex space-x-1">
            <button
              onClick={() => onViewChange('chat')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeView === 'chat'
                  ? 'bg-background-primary text-foreground-primary'
                  : 'text-foreground-secondary hover:text-foreground-primary hover:bg-background-primary'
              }`}
            >
              <MessageSquare size={16} />
              <span>Chat</span>
            </button>
            
            <button
              onClick={() => onViewChange('docs')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeView === 'docs'
                  ? 'bg-background-primary text-foreground-primary'
                  : 'text-foreground-secondary hover:text-foreground-primary hover:bg-background-primary'
              }`}
            >
              <FileText size={16} />
              <span>Documents</span>
            </button>
          </nav>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={onUploadDocument}
            className="flex items-center space-x-2 bg-accent-secondary hover:bg-accent-hover text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            <Upload size={16} />
            <span>Upload Document</span>
          </button>
        </div>
      </div>
    </header>
  );
} 