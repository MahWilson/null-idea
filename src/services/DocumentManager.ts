import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
// import * as pdf from 'pdf-parse';
// import * as mammoth from 'mammoth';
// import * as cheerio from 'cheerio';
// import { v4 as uuidv4 } from 'uuid';

export interface DocumentChunk {
    id: string;
    documentId: string;
    title: string;
    content: string;
    chunkIndex: number;
    metadata: {
        source: string;
        fileType: string;
        createdAt: Date;
        tags?: string[];
    };
}

export interface ProcessedDocument {
    id: string;
    title: string;
    source: string;
    fileType: string;
    chunks: DocumentChunk[];
    createdAt: Date;
    metadata: {
        wordCount: number;
        chunkCount: number;
        tags?: string[];
    };
}

export class DocumentManager {
    private readonly _context: vscode.ExtensionContext;
    private readonly _documents: Map<string, ProcessedDocument> = new Map();
    private readonly _storageFile: string;

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
        this._storageFile = path.join(context.globalStorageUri.fsPath, 'documents.json');
        this._loadDocuments();
    }

    public async processDocument(uri: vscode.Uri): Promise<ProcessedDocument> {
        const filePath = uri.fsPath;
        const fileName = path.basename(filePath);
        const fileExtension = path.extname(filePath).toLowerCase();

        let content = '';
        let fileType = '';

        try {
            switch (fileExtension) {
                case '.md':
                case '.txt':
                    content = await this._readTextFile(filePath);
                    fileType = 'text';
                    break;
                case '.pdf':
                    content = await this._readPdfFile(filePath);
                    fileType = 'pdf';
                    break;
                case '.docx':
                    content = await this._readDocxFile(filePath);
                    fileType = 'docx';
                    break;
                default:
                    throw new Error(`Unsupported file type: ${fileExtension}`);
            }

            const document = await this._createDocument(fileName, content, fileType, uri.fsPath);
            this._documents.set(document.id, document);
            await this._saveDocuments();

            return document;
        } catch (error) {
            throw new Error(`Failed to process document ${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async _readTextFile(filePath: string): Promise<string> {
        return fs.promises.readFile(filePath, 'utf-8');
    }

    private async _readPdfFile(filePath: string): Promise<string> {
        const dataBuffer = await fs.promises.readFile(filePath);
        // const data = await pdf(dataBuffer);
        // return data.text;
        return `[PDF content placeholder - ${filePath}]`;
    }

    private async _readDocxFile(filePath: string): Promise<string> {
        const dataBuffer = await fs.promises.readFile(filePath);
        // const result = await mammoth.extractRawText({ buffer: dataBuffer });
        // return result.value;
        return `[DOCX content placeholder - ${filePath}]`;
    }

    private async _createDocument(
        title: string,
        content: string,
        fileType: string,
        source: string
    ): Promise<ProcessedDocument> {
        const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const chunks = this._chunkContent(content, documentId, title, source, fileType);

        const document: ProcessedDocument = {
            id: documentId,
            title,
            source,
            fileType,
            chunks,
            createdAt: new Date(),
            metadata: {
                wordCount: content.split(/\s+/).length,
                chunkCount: chunks.length,
                tags: this._extractTags(content)
            }
        };

        return document;
    }

    private _chunkContent(
        content: string,
        documentId: string,
        title: string,
        source: string,
        fileType: string
    ): DocumentChunk[] {
        const chunks: DocumentChunk[] = [];
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
        
        const chunkSize = 3; // Number of sentences per chunk
        let chunkIndex = 0;

        for (let i = 0; i < sentences.length; i += chunkSize) {
            const chunkSentences = sentences.slice(i, i + chunkSize);
            const chunkContent = chunkSentences.join('. ').trim();

            if (chunkContent.length > 0) {
                const chunk: DocumentChunk = {
                    id: `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    documentId,
                    title,
                    content: chunkContent,
                    chunkIndex: chunkIndex++,
                    metadata: {
                        source,
                        fileType,
                        createdAt: new Date(),
                        tags: this._extractTags(chunkContent)
                    }
                };

                chunks.push(chunk);
            }
        }

        return chunks;
    }

    private _extractTags(content: string): string[] {
        // Simple tag extraction - can be enhanced with NLP
        const commonTags = [
            'authentication', 'api', 'database', 'frontend', 'backend',
            'deployment', 'testing', 'security', 'performance', 'ui/ux'
        ];

        const contentLower = content.toLowerCase();
        return commonTags.filter(tag => contentLower.includes(tag));
    }

    public getDocument(id: string): ProcessedDocument | undefined {
        return this._documents.get(id);
    }

    public getAllDocuments(): ProcessedDocument[] {
        return Array.from(this._documents.values());
    }

    public getDocumentChunks(documentId: string): DocumentChunk[] {
        const document = this._documents.get(documentId);
        return document ? document.chunks : [];
    }

    public searchDocuments(query: string): DocumentChunk[] {
        const queryLower = query.toLowerCase();
        const results: DocumentChunk[] = [];

        for (const document of this._documents.values()) {
            for (const chunk of document.chunks) {
                if (chunk.content.toLowerCase().includes(queryLower)) {
                    results.push(chunk);
                }
            }
        }

        return results.sort((a, b) => {
            // Simple relevance scoring
            const aScore = this._calculateRelevanceScore(a, query);
            const bScore = this._calculateRelevanceScore(b, query);
            return bScore - aScore;
        });
    }

    private _calculateRelevanceScore(chunk: DocumentChunk, query: string): number {
        const queryLower = query.toLowerCase();
        const contentLower = chunk.content.toLowerCase();
        
        let score = 0;
        
        // Exact phrase matches
        if (contentLower.includes(queryLower)) {
            score += 10;
        }
        
        // Word matches
        const queryWords = queryLower.split(/\s+/);
        queryWords.forEach(word => {
            if (contentLower.includes(word)) {
                score += 1;
            }
        });
        
        // Tag matches
        if (chunk.metadata.tags) {
            chunk.metadata.tags.forEach(tag => {
                if (queryLower.includes(tag.toLowerCase())) {
                    score += 2;
                }
            });
        }
        
        return score;
    }

    private async _loadDocuments(): Promise<void> {
        try {
            if (fs.existsSync(this._storageFile)) {
                const data = await fs.promises.readFile(this._storageFile, 'utf-8');
                const documents = JSON.parse(data);
                
                // Convert date strings back to Date objects
                for (const doc of documents) {
                    doc.createdAt = new Date(doc.createdAt);
                    doc.chunks.forEach((chunk: any) => {
                        chunk.metadata.createdAt = new Date(chunk.metadata.createdAt);
                    });
                }
                
                documents.forEach((doc: ProcessedDocument) => {
                    this._documents.set(doc.id, doc);
                });
            }
        } catch (error) {
            console.error('Failed to load documents:', error);
        }
    }

    private async _saveDocuments(): Promise<void> {
        try {
            const documents = Array.from(this._documents.values());
            const data = JSON.stringify(documents, null, 2);
            
            // Ensure directory exists
            const dir = path.dirname(this._storageFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            await fs.promises.writeFile(this._storageFile, data, 'utf-8');
        } catch (error) {
            console.error('Failed to save documents:', error);
        }
    }
} 