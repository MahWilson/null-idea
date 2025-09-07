import React from 'react';
import { Bot, User, AlertCircle } from 'lucide-react';
import { ChatMessage } from '../types';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.type === 'user';
  const isError = message.type === 'error';

  const getIcon = () => {
    if (isUser) {
      return <User size={16} className="text-white" />;
    } else if (isError) {
      return <AlertCircle size={16} className="text-white" />;
    } else {
      return <Bot size={16} className="text-white" />;
    }
  };

  const getBubbleClasses = () => {
    if (isUser) {
      return 'bg-codenection-600 text-white ml-auto';
    } else if (isError) {
      return 'bg-red-600 text-white';
    } else {
      return 'bg-background-secondary text-foreground-primary border border-border-primary';
    }
  };

  const getIconBgClasses = () => {
    if (isUser) {
      return 'bg-codenection-600';
    } else if (isError) {
      return 'bg-red-600';
    } else {
      return 'bg-codenection-600';
    }
  };

  return (
    <div className={`flex items-start space-x-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
      <div className={`flex-shrink-0 w-8 h-8 ${getIconBgClasses()} rounded-full flex items-center justify-center`}>
        {getIcon()}
      </div>
      
      <div className={`flex-1 max-w-[85%] ${getBubbleClasses()} rounded-lg p-4 animate-fade-in`}>
        {!isUser && !isError && message.context && (
          <div className="mb-3 p-3 bg-background-primary rounded border border-border-primary">
            <div className="text-xs text-foreground-muted mb-2">📚 Relevant Context:</div>
            <div className="text-sm text-foreground-secondary">
              {Array.isArray(message.context) && message.context.length > 0 ? (
                <div className="space-y-2">
                  {message.context.slice(0, 3).map((chunk: any, index: number) => (
                    <div key={index} className="text-xs">
                      <div className="font-medium text-foreground-primary">
                        {chunk.title} (Chunk {chunk.chunkIndex + 1})
                      </div>
                      <div className="text-foreground-muted mt-1">
                        {chunk.content.length > 150 
                          ? chunk.content.substring(0, 150) + '...'
                          : chunk.content
                        }
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-foreground-muted">
                  No specific context found for this query.
                </div>
              )}
            </div>
          </div>
        )}
        
        <div className="prose prose-sm prose-invert max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={{
              code({ node, inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                return !inline && match ? (
                  <SyntaxHighlighter
                    style={vscDarkPlus}
                    language={match[1]}
                    PreTag="div"
                    className="rounded-md"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                ) : (
                  <code className="bg-background-primary px-1 py-0.5 rounded text-sm" {...props}>
                    {children}
                  </code>
                );
              },
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
              li: ({ children }) => <li className="text-sm">{children}</li>,
              h1: ({ children }) => <h1 className="text-lg font-semibold mb-2">{children}</h1>,
              h2: ({ children }) => <h2 className="text-base font-semibold mb-2">{children}</h2>,
              h3: ({ children }) => <h3 className="text-sm font-semibold mb-1">{children}</h3>,
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-codenection-500 pl-4 italic text-foreground-secondary">
                  {children}
                </blockquote>
              ),
              table: ({ children }) => (
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-border-primary rounded-md">
                    {children}
                  </table>
                </div>
              ),
              th: ({ children }) => (
                <th className="border border-border-primary px-3 py-2 text-left bg-background-primary font-medium">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="border border-border-primary px-3 py-2">
                  {children}
                </td>
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
        
        <div className={`text-xs text-foreground-muted mt-3 ${isUser ? 'text-right' : ''}`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
} 