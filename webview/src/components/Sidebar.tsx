import React, { useState } from 'react';
import { Search, FileText, Tag, Calendar, Hash } from 'lucide-react';
import { DocumentInfo } from '../types';

interface SidebarProps {
  activeView: 'chat' | 'docs';
  documents: DocumentInfo[];
  onSearchDocs: (query: string) => void;
}

export function Sidebar({ activeView, documents, onSearchDocs }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearchDocs(searchQuery);
    }
  };

  if (activeView === 'docs') {
    return (
      <aside className="w-80 bg-background-secondary border-r border-border-primary flex flex-col">
        <div className="p-4 border-b border-border-primary">
          <h2 className="text-lg font-semibold text-foreground-primary mb-3">
            Documents
          </h2>
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground-muted" size={16} />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background-primary border border-border-primary rounded-md text-foreground-primary placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent-primary"
            />
          </form>
        </div>
        
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {documents.length === 0 ? (
            <div className="p-4 text-center text-foreground-secondary">
              <FileText size={48} className="mx-auto mb-2 opacity-50" />
              <p>No documents uploaded yet</p>
              <p className="text-sm">Upload documents to get started</p>
            </div>
          ) : (
            <div className="p-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="p-3 rounded-md hover:bg-background-primary transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground-primary truncate">
                        {doc.title}
                      </h3>
                      <p className="text-sm text-foreground-secondary truncate">
                        {doc.source}
                      </p>
                    </div>
                    <span className="text-xs text-foreground-muted uppercase">
                      {doc.fileType}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-4 mt-2 text-xs text-foreground-muted">
                    <div className="flex items-center space-x-1">
                      <Hash size={12} />
                      <span>{doc.metadata.wordCount} words</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <FileText size={12} />
                      <span>{doc.metadata.chunkCount} chunks</span>
                    </div>
                  </div>
                  
                  {doc.metadata.tags && doc.metadata.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {doc.metadata.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 bg-background-primary text-xs text-foreground-secondary rounded"
                        >
                          {tag}
                        </span>
                      ))}
                      {doc.metadata.tags.length > 3 && (
                        <span className="px-2 py-1 bg-background-primary text-xs text-foreground-muted rounded">
                          +{doc.metadata.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-1 mt-2 text-xs text-foreground-muted">
                    <Calendar size={12} />
                    <span>{doc.createdAt.toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    );
  }

  // Chat view sidebar - show recent context and suggestions
  return (
    <aside className="w-80 bg-background-secondary border-r border-border-primary flex flex-col">
      <div className="p-4 border-b border-border-primary">
        <h2 className="text-lg font-semibold text-foreground-primary mb-3">
          Quick Actions
        </h2>
        <div className="space-y-2">
          <button
            onClick={() => onSearchDocs('authentication')}
            className="w-full text-left p-2 rounded-md hover:bg-background-primary transition-colors text-sm text-foreground-secondary hover:text-foreground-primary"
          >
            🔐 Authentication guides
          </button>
          <button
            onClick={() => onSearchDocs('API endpoints')}
            className="w-full text-left p-2 rounded-md hover:bg-background-primary transition-colors text-sm text-foreground-secondary hover:text-foreground-primary"
          >
            🌐 API documentation
          </button>
          <button
            onClick={() => onSearchDocs('deployment')}
            className="w-full text-left p-2 rounded-md hover:bg-background-primary transition-colors text-sm text-foreground-secondary hover:text-foreground-primary"
          >
            🚀 Deployment guides
          </button>
          <button
            onClick={() => onSearchDocs('troubleshooting')}
            className="w-full text-left p-2 rounded-md hover:bg-background-primary transition-colors text-sm text-foreground-secondary hover:text-foreground-primary"
          >
            🔧 Troubleshooting
          </button>
        </div>
      </div>
      
      <div className="flex-1 p-4">
        <h3 className="text-sm font-medium text-foreground-primary mb-3">
          Recent Documents
        </h3>
        {documents.length === 0 ? (
          <p className="text-sm text-foreground-secondary">
            No documents uploaded yet. Upload some to get contextual AI assistance.
          </p>
        ) : (
          <div className="space-y-2">
            {documents.slice(0, 5).map((doc) => (
              <div
                key={doc.id}
                className="p-2 rounded-md hover:bg-background-primary transition-colors cursor-pointer"
              >
                <h4 className="text-sm font-medium text-foreground-primary truncate">
                  {doc.title}
                </h4>
                <p className="text-xs text-foreground-secondary">
                  {doc.metadata.wordCount} words • {doc.metadata.chunkCount} chunks
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
} 