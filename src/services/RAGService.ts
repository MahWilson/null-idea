import * as vscode from 'vscode';
import { DocumentManager, DocumentChunk } from './DocumentManager';

export interface SearchResult {
    chunk: DocumentChunk;
    relevanceScore: number;
    excerpt: string;
}

export interface RAGContext {
    query: string;
    relevantChunks: DocumentChunk[];
    summary: string;
    suggestedActions: string[];
}

export class RAGService {
    private readonly _context: vscode.ExtensionContext;
    private readonly _documentManager: DocumentManager;

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
        this._documentManager = new DocumentManager(context);
    }

    public async search(query: string, limit: number = 10): Promise<SearchResult[]> {
        const allChunks = this._getAllChunks();
        const results: SearchResult[] = [];

        for (const chunk of allChunks) {
            const score = this._calculateRelevanceScore(chunk, query);
            if (score > 0) {
                const excerpt = this._generateExcerpt(chunk.content, query);
                results.push({
                    chunk,
                    relevanceScore: score,
                    excerpt
                });
            }
        }

        // Sort by relevance score and limit results
        return results
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, limit);
    }

    public async getRelevantContext(query: string, maxChunks: number = 5): Promise<DocumentChunk[]> {
        const searchResults = await this.search(query, maxChunks);
        return searchResults.map(result => result.chunk);
    }

    public async generateRAGContext(query: string): Promise<RAGContext> {
        const relevantChunks = await this.getRelevantContext(query, 5);
        const summary = this._generateContextSummary(query, relevantChunks);
        const suggestedActions = this._generateSuggestedActions(query, relevantChunks);

        return {
            query,
            relevantChunks,
            summary,
            suggestedActions
        };
    }

    public async getDocumentSummary(documentId: string): Promise<string> {
        const document = this._documentManager.getDocument(documentId);
        if (!document) {
            throw new Error(`Document not found: ${documentId}`);
        }

        const chunks = document.chunks;
        const content = chunks.map(chunk => chunk.content).join(' ');
        
        // Simple summary generation - can be enhanced with AI
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const summarySentences = sentences.slice(0, 3);
        
        return summarySentences.join('. ') + '.';
    }

    public async getRelatedDocuments(documentId: string): Promise<DocumentChunk[]> {
        const document = this._documentManager.getDocument(documentId);
        if (!document) {
            return [];
        }

        const documentTags = document.metadata.tags || [];
        const allChunks = this._getAllChunks();
        const related: DocumentChunk[] = [];

        for (const chunk of allChunks) {
            if (chunk.documentId === documentId) continue;

            const chunkTags = chunk.metadata.tags || [];
            const commonTags = documentTags.filter(tag => chunkTags.includes(tag));

            if (commonTags.length > 0) {
                related.push(chunk);
            }
        }

        return related.slice(0, 5);
    }

    private _getAllChunks(): DocumentChunk[] {
        const documents = this._documentManager.getAllDocuments();
        const allChunks: DocumentChunk[] = [];
        
        for (const document of documents) {
            allChunks.push(...document.chunks);
        }
        
        return allChunks;
    }

    private _calculateRelevanceScore(chunk: DocumentChunk, query: string): number {
        const queryLower = query.toLowerCase();
        const contentLower = chunk.content.toLowerCase();
        let score = 0;

        // Exact phrase match (highest priority)
        if (contentLower.includes(queryLower)) {
            score += 100;
        }

        // Word frequency scoring
        const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);
        const contentWords = contentLower.split(/\s+/);

        for (const queryWord of queryWords) {
            const wordCount = contentWords.filter(word => word.includes(queryWord)).length;
            score += wordCount * 5;
        }

        // Tag matching
        if (chunk.metadata.tags) {
            for (const tag of chunk.metadata.tags) {
                if (queryLower.includes(tag.toLowerCase())) {
                    score += 20;
                }
            }
        }

        // Recency bonus (newer documents get slight boost)
        const daysSinceCreation = (Date.now() - chunk.metadata.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceCreation < 30) {
            score += 2;
        }

        return score;
    }

    private _generateExcerpt(content: string, query: string, maxLength: number = 200): string {
        const queryLower = query.toLowerCase();
        const contentLower = content.toLowerCase();
        
        // Find the position of the first query match
        const queryIndex = contentLower.indexOf(queryLower);
        
        if (queryIndex === -1) {
            // No exact match, return beginning of content
            return content.length > maxLength 
                ? content.substring(0, maxLength) + '...'
                : content;
        }

        // Calculate start and end positions for excerpt
        const start = Math.max(0, queryIndex - maxLength / 2);
        const end = Math.min(content.length, queryIndex + maxLength / 2);
        
        let excerpt = content.substring(start, end);
        
        // Add ellipsis if we're not at the beginning/end
        if (start > 0) excerpt = '...' + excerpt;
        if (end < content.length) excerpt = excerpt + '...';
        
        return excerpt;
    }

    private _generateContextSummary(query: string, chunks: DocumentChunk[]): string {
        if (chunks.length === 0) {
            return `No relevant documentation found for: "${query}"`;
        }

        const documentTitles = [...new Set(chunks.map(chunk => chunk.title))];
        const totalChunks = chunks.length;
        
        return `Found ${totalChunks} relevant document chunks from ${documentTitles.length} documents: ${documentTitles.join(', ')}.`;
    }

    private _generateSuggestedActions(query: string, chunks: DocumentChunk[]): string[] {
        const actions: string[] = [];
        
        if (chunks.length === 0) {
            actions.push('Upload relevant documentation to improve search results');
            actions.push('Try rephrasing your query with different keywords');
            return actions;
        }

        // Analyze query intent and suggest actions
        const queryLower = query.toLowerCase();
        
        if (queryLower.includes('how') || queryLower.includes('implement')) {
            actions.push('Review the provided code examples and implementation details');
            actions.push('Check related documentation for step-by-step guides');
        }
        
        if (queryLower.includes('error') || queryLower.includes('problem')) {
            actions.push('Review error handling documentation');
            actions.push('Check troubleshooting guides in the provided chunks');
        }
        
        if (queryLower.includes('api') || queryLower.includes('endpoint')) {
            actions.push('Review API documentation and examples');
            actions.push('Check authentication and usage patterns');
        }

        actions.push('Ask follow-up questions for more specific guidance');
        
        return actions;
    }

    public async getDocumentStats(): Promise<{
        totalDocuments: number;
        totalChunks: number;
        averageChunkSize: number;
        topTags: Array<{ tag: string; count: number }>;
    }> {
        const documents = this._documentManager.getAllDocuments();
        const allChunks = this._getAllChunks();
        
        // Calculate statistics
        const totalDocuments = documents.length;
        const totalChunks = allChunks.length;
        const averageChunkSize = totalChunks > 0 
            ? allChunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / totalChunks
            : 0;

        // Count tag frequencies
        const tagCounts: Map<string, number> = new Map();
        for (const chunk of allChunks) {
            if (chunk.metadata.tags) {
                for (const tag of chunk.metadata.tags) {
                    tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
                }
            }
        }

        const topTags = Array.from(tagCounts.entries())
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        return {
            totalDocuments,
            totalChunks,
            averageChunkSize: Math.round(averageChunkSize),
            topTags
        };
    }
} 