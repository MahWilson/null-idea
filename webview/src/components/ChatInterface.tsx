import { Bot, Send } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { ChatMessage } from '../types';
import { MessageBubble } from './MessageBubble';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (content: string) => void;
}

export function ChatInterface({ messages, isLoading, onSendMessage }: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  };

  return (
    <div className="flex-1 flex flex-col bg-background-primary">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-foreground-secondary">
            <Bot size={64} className="mb-4 opacity-50" />
            <h2 className="text-xl font-semibold mb-2">Welcome to Documind</h2>
            <p className="text-sm max-w-md">
              I'm your AI-powered documentation assistant. Ask me questions about your code, 
              documentation, or technical concepts. I'll search through your uploaded documents 
              to provide relevant answers.
            </p>
            <div className="mt-6 space-y-2 text-sm">
              <p>💡 <strong>Try asking:</strong></p>
              <ul className="space-y-1 text-left">
                <li>• "How do I implement user authentication?"</li>
                <li>• "What are the API endpoints for user management?"</li>
                <li>• "How do I deploy this application?"</li>
                <li>• "What's the best practice for error handling?"</li>
              </ul>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
        
        {isLoading && (
          <div className="flex items-start space-x-3 animate-fade-in">
            <div className="flex-shrink-0 w-8 h-8 bg-codenection-600 rounded-full flex items-center justify-center">
              <Bot size={16} className="text-white" />
            </div>
            <div className="flex-1 bg-background-secondary border border-border-primary rounded-lg p-4">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-foreground-muted rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-foreground-muted rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-foreground-muted rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-border-primary p-4 bg-background-secondary">
        <form onSubmit={handleSubmit} className="flex space-x-3">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything about your documentation..."
              disabled={isLoading}
              className="w-full resize-none bg-background-primary border border-border-primary rounded-lg px-4 py-3 text-foreground-primary placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent min-h-[44px] max-h-[120px]"
              rows={1}
            />
          </div>
          
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="flex-shrink-0 w-12 h-12 bg-codenection-600 hover:bg-codenection-700 disabled:bg-foreground-muted disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2"
          >
            <Send size={20} />
          </button>
        </form>
        
        <div className="mt-2 text-xs text-foreground-muted text-center">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  );
} 