import React, { useState, useEffect } from 'react';
import { ChatInterface } from './components/ChatInterface';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { useVSCodeMessage } from './hooks/useVSCodeMessage';
import { ChatMessage, DocumentInfo } from './types';

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeView, setActiveView] = useState<'chat' | 'docs'>('chat');

  // Listen for messages from VS Code extension
  useVSCodeMessage((message) => {
    switch (message.command) {
      case 'chatResponse':
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: 'ai',
          content: message.response,
          timestamp: new Date(),
          context: message.context
        }]);
        setIsLoading(false);
        break;
      
      case 'documentUploaded':
        // Refresh documents list
        // TODO: Implement document list refresh
        break;
      
      case 'searchResults':
        // Handle search results
        break;
      
      case 'error':
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: 'error',
          content: `Error: ${message.error}`,
          timestamp: new Date()
        }]);
        setIsLoading(false);
        break;
    }
  });

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Send message to VS Code extension
    if (window.vscode) {
      window.vscode.postMessage({
        command: 'chat',
        text: content
      });
    }
  };

  const handleUploadDocument = () => {
    if (window.vscode) {
      window.vscode.postMessage({
        command: 'uploadDocument'
      });
    }
  };

  const handleSearchDocs = (query: string) => {
    if (window.vscode) {
      window.vscode.postMessage({
        command: 'searchDocs',
        query
      });
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background-primary">
      <Header 
        activeView={activeView}
        onViewChange={setActiveView}
        onUploadDocument={handleUploadDocument}
      />
      
      <div className="flex-1 flex overflow-hidden">
        <Sidebar 
          activeView={activeView}
          documents={documents}
          onSearchDocs={handleSearchDocs}
        />
        
        <main className="flex-1 flex flex-col">
          {activeView === 'chat' ? (
            <ChatInterface
              messages={messages}
              isLoading={isLoading}
              onSendMessage={handleSendMessage}
            />
          ) : (
            <div className="flex-1 p-6">
              <h2 className="text-xl font-semibold mb-4">Documentation</h2>
              <p className="text-foreground-secondary">
                Document management interface coming soon...
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App; 