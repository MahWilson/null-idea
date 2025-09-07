import * as crypto from 'crypto';
import * as path from 'path';
import * as vscode from 'vscode';

export interface ChangeRecord {
    id: string;
    type: 'file_created' | 'file_modified' | 'file_deleted' | 'content_generated' | 'content_updated';
    action: 'auto' | 'manual';
    status: 'applied' | 'pending' | 'reverted';
    title: string;
    description: string;
    filePath: string;
    timestamp: Date;
    originalContent?: string;
    newContent?: string;
    diff?: string;
    metadata?: {
        generatedBy?: string;
        reason?: string;
        docType?: string;
        taskTitle?: string;
    };
}

export interface ActivityEntry {
    id: string;
    type: 'Auto' | 'Manual';
    status: 'Applied' | 'Pending' | 'Reverted';
    title: string;
    when: string;
    desc: string;
    changeRecord?: ChangeRecord;
}

export class ChangeTracker {
    private changes: ChangeRecord[] = [];
    private storageKey = 'codenection-changes';

    constructor(private context: vscode.ExtensionContext) {
        this.loadChanges();
    }

    private loadChanges() {
        try {
            const stored = this.context.globalState.get<string>(this.storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                this.changes = parsed.map((change: any) => ({
                    ...change,
                    timestamp: new Date(change.timestamp)
                }));
            }
        } catch (error) {
            console.error('Error loading changes:', error);
            this.changes = [];
        }
    }

    public saveChanges() {
        try {
            this.context.globalState.update(this.storageKey, JSON.stringify(this.changes));
        } catch (error) {
            console.error('Error saving changes:', error);
        }
    }

    public async trackFileCreation(filePath: string, content: string, metadata?: any): Promise<ChangeRecord> {
        const change: ChangeRecord = {
            id: this.generateId(),
            type: 'file_created',
            action: 'auto',
            status: 'applied',
            title: `Created ${this.getFileName(filePath)}`,
            description: `Generated new documentation file: ${this.getFileName(filePath)}`,
            filePath,
            timestamp: new Date(),
            newContent: content,
            metadata: {
                generatedBy: 'Documind AI',
                reason: 'Documentation generation',
                ...metadata
            }
        };

        this.changes.unshift(change);
        this.saveChanges();
        return change;
    }

    public async trackFileModification(filePath: string, originalContent: string, newContent: string, metadata?: any): Promise<ChangeRecord> {
        const change: ChangeRecord = {
            id: this.generateId(),
            type: 'file_modified',
            action: 'auto',
            status: 'applied',
            title: `Updated ${this.getFileName(filePath)}`,
            description: `Modified documentation file: ${this.getFileName(filePath)}`,
            filePath,
            timestamp: new Date(),
            originalContent,
            newContent,
            diff: this.generateDiff(originalContent, newContent),
            metadata: {
                generatedBy: 'Documind AI',
                reason: 'Documentation update',
                ...metadata
            }
        };

        this.changes.unshift(change);
        this.saveChanges();
        return change;
    }

    public async trackContentGeneration(docType: string, content: string, filePath: string, metadata?: any): Promise<ChangeRecord> {
        const change: ChangeRecord = {
            id: this.generateId(),
            type: 'content_generated',
            action: 'auto',
            status: 'applied',
            title: `Generated ${docType} documentation`,
            description: `AI-generated ${docType} documentation content`,
            filePath,
            timestamp: new Date(),
            newContent: content,
            metadata: {
                generatedBy: 'Documind AI',
                docType,
                reason: 'AI content generation',
                ...metadata
            }
        };

        this.changes.unshift(change);
        this.saveChanges();
        return change;
    }

    public async trackManualAction(title: string, description: string, filePath: string, originalContent?: string, newContent?: string): Promise<ChangeRecord> {
        const change: ChangeRecord = {
            id: this.generateId(),
            type: originalContent && newContent ? 'file_modified' : 'content_updated',
            action: 'manual',
            status: 'pending',
            title,
            description,
            filePath,
            timestamp: new Date(),
            originalContent,
            newContent,
            diff: originalContent && newContent ? this.generateDiff(originalContent, newContent) : undefined,
            metadata: {
                generatedBy: 'User',
                reason: 'Manual action'
            }
        };

        this.changes.unshift(change);
        this.saveChanges();
        return change;
    }

    public getActivities(): ActivityEntry[] {
        return this.changes.map(change => ({
            id: change.id,
            type: change.action === 'auto' ? 'Auto' : 'Manual',
            status: this.mapStatus(change.status),
            title: change.title,
            when: this.formatTimeAgo(change.timestamp),
            desc: change.description,
            changeRecord: change
        }));
    }

    public getChangeById(id: string): ChangeRecord | undefined {
        return this.changes.find(change => change.id === id);
    }

    public async viewDiff(changeId: string): Promise<void> {
        const change = this.getChangeById(changeId);
        if (!change) {
            vscode.window.showErrorMessage('Change not found');
            return;
        }

        let diffContent = `# Diff: ${change.title}

**File:** ${change.filePath}
**Type:** ${change.type}
**Action:** ${change.action}
**Status:** ${change.status}
**Timestamp:** ${change.timestamp.toLocaleString()}

`;

        if (change.diff) {
            diffContent += `## Changes
\`\`\`diff
${change.diff}
\`\`\`

`;
        } else if (change.type === 'file_created' || change.type === 'content_generated') {
            diffContent += `## New File Content
\`\`\`markdown
${change.newContent || 'N/A'}
\`\`\`

`;
        }

        diffContent += `## Original Content
\`\`\`markdown
${change.originalContent || 'N/A'}
\`\`\`

## New Content
\`\`\`markdown
${change.newContent || 'N/A'}
\`\`\`

## Metadata
${change.metadata ? JSON.stringify(change.metadata, null, 2) : 'None'}`;

        const doc = await vscode.workspace.openTextDocument({
            content: diffContent,
            language: 'markdown'
        });
        
        await vscode.window.showTextDocument(doc, { preview: false });
    }

    public async applyChange(changeId: string): Promise<boolean> {
        const change = this.getChangeById(changeId);
        if (!change) {
            vscode.window.showErrorMessage('Change not found');
            return false;
        }

        if (change.status === 'applied') {
            vscode.window.showInformationMessage('Change is already applied');
            return false;
        }

        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('No workspace folder found');
                return false;
            }

            // Handle both relative and absolute paths
            let filePath = change.filePath;
            if (filePath.startsWith(workspaceFolder.uri.fsPath)) {
                // If it's an absolute path, make it relative
                filePath = filePath.replace(workspaceFolder.uri.fsPath + path.sep, '').replace(/\\/g, '/');
            }
            
            const uri = vscode.Uri.joinPath(workspaceFolder.uri, filePath);
            
            if (change.type === 'file_created' || change.type === 'content_generated') {
                // Create directory if it doesn't exist
                const dirPath = filePath.split('/').slice(0, -1).join('/');
                if (dirPath) {
                    const dir = vscode.Uri.joinPath(workspaceFolder.uri, dirPath);
                    try {
                        await vscode.workspace.fs.stat(dir);
                    } catch {
                        await vscode.workspace.fs.createDirectory(dir);
                    }
                }
                
                await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(change.newContent || ''));
            } else if (change.type === 'file_modified' && change.newContent) {
                await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(change.newContent));
            }

            // Update change status
            change.status = 'applied';
            this.saveChanges();

            vscode.window.showInformationMessage(`Applied change: ${change.title}`);
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to apply change: ${error}`);
            return false;
        }
    }

    public async revertChange(changeId: string): Promise<boolean> {
        const change = this.getChangeById(changeId);
        if (!change) {
            vscode.window.showErrorMessage('Change not found');
            return false;
        }

        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('No workspace folder found');
                return false;
            }

            // Handle both relative and absolute paths
            let filePath = change.filePath;
            if (filePath.startsWith(workspaceFolder.uri.fsPath)) {
                // If it's an absolute path, make it relative
                filePath = filePath.replace(workspaceFolder.uri.fsPath + path.sep, '').replace(/\\/g, '/');
            }
            
            const uri = vscode.Uri.joinPath(workspaceFolder.uri, filePath);

            if (change.type === 'file_created' || change.type === 'content_generated') {
                // Delete the file
                try {
                    await vscode.workspace.fs.delete(uri);
                } catch (error) {
                    // File might not exist, that's okay
                }
            } else if (change.type === 'file_modified' && change.originalContent) {
                // Restore original content
                await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(change.originalContent));
            }

            // Update change status
            change.status = 'reverted';
            this.saveChanges();

            vscode.window.showInformationMessage(`Reverted change: ${change.title}`);
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to revert change: ${error}`);
            return false;
        }
    }

    private generateId(): string {
        return crypto.randomBytes(8).toString('hex');
    }

    private getFileName(filePath: string): string {
        return filePath.split('/').pop() || filePath;
    }

    private generateDiff(oldContent: string, newContent: string): string {
        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');
        
        let diff = '';
        const maxLines = Math.max(oldLines.length, newLines.length);
        
        for (let i = 0; i < maxLines; i++) {
            const oldLine = oldLines[i] || '';
            const newLine = newLines[i] || '';
            
            if (oldLine !== newLine) {
                if (oldLine) diff += `- ${oldLine}\n`;
                if (newLine) diff += `+ ${newLine}\n`;
            } else {
                diff += `  ${oldLine}\n`;
            }
        }
        
        return diff;
    }

    private mapStatus(status: string): 'Applied' | 'Pending' | 'Reverted' {
        switch (status) {
            case 'applied': return 'Applied';
            case 'pending': return 'Pending';
            case 'reverted': return 'Reverted';
            default: return 'Pending';
        }
    }

    private formatTimeAgo(date: Date): string {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }

    public clearAllChanges(): void {
        this.changes = [];
        this.saveChanges();
    }

    public getChangeStats(): { total: number; applied: number; pending: number; reverted: number } {
        return {
            total: this.changes.length,
            applied: this.changes.filter(c => c.status === 'applied').length,
            pending: this.changes.filter(c => c.status === 'pending').length,
            reverted: this.changes.filter(c => c.status === 'reverted').length
        };
    }
}
