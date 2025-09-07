
export type DocsServiceClientOptions = {
    baseUrl?: string;
    timeoutMs?: number;
};

/**
 * Stubbed client for future external AI/RAG service.
 * All methods return placeholder data and perform no network calls.
 */
export class DocsServiceClient {
    private readonly baseUrl: string;
    private readonly timeoutMs: number;

    constructor(options?: DocsServiceClientOptions) {
        this.baseUrl = options?.baseUrl || 'http://localhost:0';
        this.timeoutMs = options?.timeoutMs ?? 10_000;
    }

    async generateDocumentationDraft(input: { codeSnippet?: string; filePath?: string; tone?: string; format?: 'md'|'html' }): Promise<string> {
        const header = `# Documentation Draft\n\n`;
        const body = input.codeSnippet
            ? `Generated from code snippet (placeholder).\n\n\`\`\`\n${input.codeSnippet}\n\`\`\`\n`
            : `Generated from file: ${input.filePath ?? '(unknown)'} (placeholder).\n`;
        const footer = `\n> Tone: ${input.tone ?? 'neutral'} • Format: ${input.format ?? 'md'}\n`;
        return header + body + footer;
    }

    async summarizeDocument(input: { content: string; maxTokens?: number }): Promise<string> {
        const preview = input.content.slice(0, 240);
        return `**Summary (placeholder)**: ${preview}${input.content.length > 240 ? '…' : ''}`;
    }

    /** Placeholder for future embeddings/RAG search */
    async searchRelevantChunks(_query: string): Promise<Array<{ title: string; snippet: string }>> {
        return [
            { title: 'Placeholder Guide', snippet: 'This is a stubbed search result explaining how docs are generated.' }
        ];
    }
}


