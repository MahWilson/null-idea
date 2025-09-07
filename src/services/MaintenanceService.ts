import * as vscode from 'vscode';

export interface GitHubPR {
    id: string;
    number: number;
    title: string;
    description: string;
    author: string;
    status: 'open' | 'merged' | 'closed';
    filesChanged: string[];
    docImpact: 'high' | 'medium' | 'low';
    suggestedActions: string[];
}

export interface DocumentUpdate {
    filePath: string;
    currentContent: string;
    suggestedContent: string;
    reason: string;
    priority: 'high' | 'medium' | 'low';
}

export interface ChangelogEntry {
    version: string;
    date: string;
    type: 'added' | 'changed' | 'fixed' | 'removed';
    description: string;
    commits: string[];
}

export interface MaintenanceNotification {
    id: string;
    type: 'pr' | 'doc_update' | 'changelog' | 'stale_doc';
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    actions: NotificationAction[];
    metadata: any;
    timestamp: Date;
}

export interface NotificationAction {
    id: string;
    label: string;
    type: 'view' | 'generate' | 'update' | 'open' | 'suggest';
    command: string;
    icon?: string;
}

export class MaintenanceService {
    private notifications: MaintenanceNotification[] = [];
    private prs: GitHubPR[] = [];
    private documentUpdates: DocumentUpdate[] = [];

    constructor() {
        this.initializeSampleData();
    }

    private initializeSampleData() {
        // Sample GitHub PRs
        this.prs = [
            {
                id: 'pr-1024',
                number: 1024,
                title: 'Update API endpoints',
                description: 'Added new user authentication endpoints and updated existing API structure',
                author: 'john.doe',
                status: 'open',
                filesChanged: ['src/api/user-service.ts', 'src/routes/auth.ts', 'src/middleware/auth.ts'],
                docImpact: 'high',
                suggestedActions: ['Update API documentation', 'Update authentication guide', 'Update changelog']
            },
            {
                id: 'pr-1021',
                number: 1021,
                title: 'Refactor database models',
                description: 'Restructured database models for better performance and added new indexes',
                author: 'jane.smith',
                status: 'merged',
                filesChanged: ['src/models/user.ts', 'src/models/product.ts', 'src/database/migrations/'],
                docImpact: 'medium',
                suggestedActions: ['Update database documentation', 'Update setup guide']
            }
        ];

        // Sample document updates
        this.documentUpdates = [
            {
                filePath: 'README.md',
                currentContent: `# Project Name

## Installation
\`\`\`bash
npm install
npm run start
\`\`\`

## Usage
Run the application with the old command.`,
                suggestedContent: `# Project Name

## Installation
\`\`\`bash
npm install
npm run dev
\`\`\`

## Usage
Run the application with the new development command.`,
                reason: 'README references old scripts; diff suggests changes.',
                priority: 'medium'
            }
        ];

        // Generate notifications
        this.generateNotifications();
    }

    private generateNotifications() {
        this.notifications = [];

        // PR notifications
        this.prs.forEach(pr => {
            if (pr.status === 'open' && pr.docImpact !== 'low') {
                this.notifications.push({
                    id: `pr-${pr.number}`,
                    type: 'pr',
                    title: `PR #${pr.number}: ${pr.title}`,
                    description: `Potential doc changes detected in ${pr.filesChanged[0]}.`,
                    priority: pr.docImpact,
                    actions: [
                        {
                            id: 'view-pr',
                            label: 'View PR',
                            type: 'view',
                            command: 'viewPR',
                            icon: '🔍'
                        },
                        {
                            id: 'suggest-doc-update',
                            label: 'Suggest doc update',
                            type: 'suggest',
                            command: 'suggestDocUpdate',
                            icon: '📝'
                        }
                    ],
                    metadata: { pr },
                    timestamp: new Date()
                });
            }
        });

        // Stale document notifications
        this.documentUpdates.forEach(update => {
            this.notifications.push({
                id: `stale-${update.filePath.replace(/[^a-zA-Z0-9]/g, '-')}`,
                type: 'stale_doc',
                title: `${update.filePath} may be stale`,
                description: update.reason,
                priority: update.priority,
                actions: [
                    {
                        id: 'open-doc',
                        label: 'Open README',
                        type: 'open',
                        command: 'openDocument',
                        icon: '📖'
                    },
                    {
                        id: 'generate-update',
                        label: 'Generate update',
                        type: 'generate',
                        command: 'generateUpdate',
                        icon: '🔄'
                    }
                ],
                metadata: { update },
                timestamp: new Date()
            });
        });

        // Changelog notifications
        this.notifications.push({
            id: 'changelog-missing',
            type: 'changelog',
            title: 'Changelog missing entries',
            description: '3 commits without changelog notes.',
            priority: 'low',
            actions: [
                {
                    id: 'generate-changelog',
                    label: 'Generate changelog',
                    type: 'generate',
                    command: 'generateChangelog',
                    icon: '📋'
                }
            ],
            metadata: { 
                missingCommits: [
                    'feat: Add user authentication',
                    'fix: Resolve database connection issue',
                    'docs: Update API documentation'
                ]
            },
            timestamp: new Date()
        });
    }

    public getNotifications(): MaintenanceNotification[] {
        return this.notifications.sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }

    public getPRs(): GitHubPR[] {
        return this.prs;
    }

    public getPRById(id: string): GitHubPR | undefined {
        return this.prs.find(pr => pr.id === id);
    }

    public getDocumentUpdates(): DocumentUpdate[] {
        return this.documentUpdates;
    }

    public async viewPR(prId: string): Promise<void> {
        const pr = this.getPRById(prId);
        if (!pr) return;

        // Simulate opening PR in browser
        const prUrl = `https://github.com/your-org/your-repo/pull/${pr.number}`;
        await vscode.env.openExternal(vscode.Uri.parse(prUrl));
        
        // Show PR details in a new editor
        const content = `# PR #${pr.number}: ${pr.title}

**Author:** ${pr.author}
**Status:** ${pr.status}
**Description:** ${pr.description}

## Files Changed
${pr.filesChanged.map(file => `- ${file}`).join('\n')}

## Suggested Documentation Actions
${pr.suggestedActions.map(action => `- ${action}`).join('\n')}

## PR URL
${prUrl}`;

        const doc = await vscode.workspace.openTextDocument({
            content,
            language: 'markdown'
        });
        await vscode.window.showTextDocument(doc, { preview: false });
    }

    public async openDocument(filePath: string): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return;

        const uri = vscode.Uri.joinPath(workspaceFolder.uri, filePath);
        try {
            const doc = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(doc, { preview: false });
        } catch (error) {
            vscode.window.showErrorMessage(`Could not open ${filePath}: ${error}`);
        }
    }

    public async generateUpdate(filePath: string): Promise<void> {
        const update = this.documentUpdates.find(u => u.filePath === filePath);
        if (!update) return;

        // Show diff between current and suggested content
        const diffContent = this.generateDiff(update.currentContent, update.suggestedContent);
        
        const doc = await vscode.workspace.openTextDocument({
            content: `# Document Update: ${filePath}

## Reason for Update
${update.reason}

## Suggested Changes
\`\`\`diff
${diffContent}
\`\`\`

## Actions
- [ ] Review changes
- [ ] Apply update
- [ ] Reject update

## Current Content
\`\`\`markdown
${update.currentContent}
\`\`\`

## Suggested Content
\`\`\`markdown
${update.suggestedContent}
\`\`\``,
            language: 'markdown'
        });
        
        await vscode.window.showTextDocument(doc, { preview: false });
    }

    public async generateChangelog(): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return;

        const changelogPath = vscode.Uri.joinPath(workspaceFolder.uri, 'CHANGELOG.md');
        
        // Generate changelog entries
        const entries: ChangelogEntry[] = [
            {
                version: '1.2.0',
                date: new Date().toISOString().split('T')[0],
                type: 'added',
                description: 'Add user authentication system',
                commits: ['feat: Add user authentication', 'feat: Add JWT token handling']
            },
            {
                version: '1.1.1',
                date: new Date().toISOString().split('T')[0],
                type: 'fixed',
                description: 'Resolve database connection issues',
                commits: ['fix: Resolve database connection issue']
            }
        ];

        const changelogContent = this.generateChangelogContent(entries);
        
        const doc = await vscode.workspace.openTextDocument({
            content: changelogContent,
            language: 'markdown'
        });
        
        await vscode.window.showTextDocument(doc, { preview: false });
    }

    private generateDiff(oldContent: string, newContent: string): string {
        // Simple diff generation (in a real implementation, you'd use a proper diff library)
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

    private generateChangelogContent(entries: ChangelogEntry[]): string {
        let content = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`;

        entries.forEach(entry => {
            content += `## [${entry.version}] - ${entry.date}\n\n`;
            content += `### ${entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}\n`;
            content += `- ${entry.description}\n\n`;
            
            if (entry.commits.length > 0) {
                content += `**Commits:**\n`;
                entry.commits.forEach(commit => {
                    content += `- ${commit}\n`;
                });
                content += '\n';
            }
        });

        return content;
    }

    public async suggestDocUpdate(prId: string): Promise<void> {
        const pr = this.getPRById(prId);
        if (!pr) return;

        const suggestions = pr.suggestedActions.map(action => `- ${action}`).join('\n');
        
        const content = `# Documentation Update Suggestions for PR #${pr.number}

## PR Details
**Title:** ${pr.title}
**Author:** ${pr.author}
**Files Changed:** ${pr.filesChanged.length} files

## Suggested Documentation Updates
${suggestions}

## Impact Analysis
**Documentation Impact:** ${pr.docImpact.toUpperCase()}

## Recommended Actions
1. Review changed files for documentation impact
2. Update relevant documentation files
3. Add changelog entry if needed
4. Update API documentation if endpoints changed

## Files to Review
${pr.filesChanged.map(file => `- ${file}`).join('\n')}`;

        const doc = await vscode.workspace.openTextDocument({
            content,
            language: 'markdown'
        });
        
        await vscode.window.showTextDocument(doc, { preview: false });
    }
}
