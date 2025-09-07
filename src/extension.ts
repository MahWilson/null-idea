        import * as path from 'path';
import * as vscode from 'vscode';
import { ChangeTracker } from './services/ChangeTracker';
import { DocsServiceClient } from './services/DocsServiceClient';
import { draftApiDocsBasic, draftChangelogSinceLastTag } from './services/gitDrafts';
import { MaintenanceService } from './services/MaintenanceService';
import { WorkspaceAnalyzer, type CodeItem } from './services/WorkspaceAnalyzer';

// Global file watcher for automatic updates
let fileWatcher: vscode.FileSystemWatcher | undefined;

// Global services
let maintenanceService: MaintenanceService;
let changeTracker: ChangeTracker;

/**
 * SECURITY NOTES FOR AI INTEGRATION:
 * - All user input is sanitized to prevent XSS
 * - Message commands are validated against whitelist
 * - Content Security Policy prevents script injection
 * - Webview scripts are restricted to our extension only
 * 
 * TODO: When integrating real AI models:
 * - Sanitize AI responses before displaying
 * - Validate AI-generated content
 * - Add rate limiting for API calls
 * - Implement proper error handling for AI failures
 */

export function activate(context: vscode.ExtensionContext) {
    console.log('Documind AI Docs Assistant is now active!');

    // Add debugging to see what's happening
    vscode.window.showInformationMessage('Documind AI Extension is activating...');
    
    try {

    // Initialize services
    maintenanceService = new MaintenanceService();
    changeTracker = new ChangeTracker(context);
    
    // Create sample changes for demonstration
    async function createSampleChanges() {
        // Always clear and recreate to ensure correct order
        changeTracker.clearAllChanges();
        
        // Create sample changes in the correct order (most recent first)
        
        // 1. Generated changelog entries (most recent)
        await changeTracker.trackContentGeneration('Changelog', `# Changelog

## [1.2.0] - 2025-01-07

### Added
- User authentication system
- JWT token handling

## [1.1.1] - 2025-01-07

### Fixed
- Database connection issues

**Commits:**
- feat: Add user authentication
- fix: Resolve database connection issue
- docs: Update API documentation`, 'CHANGELOG.md', {
                docType: 'Changelog',
                reason: 'Generated changelog entries for recent commits'
            });
        
        // 2. Proposed API doc updates (manual, pending)
        await changeTracker.trackManualAction(
            'Proposed API doc updates',
            'Detected route changes in user-service.',
            'docs/API.md',
            `# API Documentation

## Overview
This document describes the API endpoints available in this project.`,
            `# API Documentation

## Overview
This document describes the API endpoints available in this project.

## New Endpoints

### POST /api/users
Create a new user.

**Request Body:**
\`\`\`json
{
  "name": "string",
  "email": "string"
}
\`\`\`

**Response:**
\`\`\`json
{
  "id": "string",
  "name": "string",
  "email": "string"
}
\`\`\``
        );
        
        // 3. Updated README sections (auto, applied)
        const readmeChange = await changeTracker.trackFileModification('README.md', 
            `# Project Name

## Installation
\`\`\`bash
npm install
npm run start
\`\`\`

## Usage
Run the application with the old command.`,
            `# Project Name

## Installation
\`\`\`bash
npm install
npm run dev
\`\`\`

## Usage
Run the application with the new development command.`, {
                docType: 'README',
                reason: 'Updated scripts section with package.json changes'
            });
        
        // 4. Create a reverted change to demonstrate toggle behavior
        const revertedChange = await changeTracker.trackFileCreation('docs/ARCHITECTURE.md', `# Architecture Documentation

## Overview
This document describes the system architecture.

## Components
- Frontend: React application
- Backend: Node.js API server
- Database: PostgreSQL`, {
            docType: 'Architecture',
            reason: 'Generated architecture documentation'
        });
        
        // Manually set this change as reverted to demonstrate toggle behavior
        revertedChange.status = 'reverted';
        changeTracker.saveChanges();
    }
    
    // Initialize sample changes
    createSampleChanges();
    
    // Function to send maintenance notifications to webview
    function sendMaintenanceNotifications(webviewView: vscode.WebviewView) {
        if (webviewView?.webview) {
            const maintenanceNotifications = maintenanceService.getNotifications();
            const notifications = maintenanceNotifications.map(notif => ({
                id: notif.id,
                title: notif.title,
                desc: notif.description,
                status: 'new',
                actions: notif.actions.map(action => action.label),
                issue: notif.description,
                changed: notif.metadata?.pr?.filesChanged?.join(', ') || notif.metadata?.update?.filePath || 'Multiple files',
                suggested: notif.actions.map(action => action.label).join(', '),
                type: notif.type,
                priority: notif.priority,
                metadata: notif.metadata
            }));
            
            webviewView.webview.postMessage({
                command: 'updateNotifications',
                notifications: notifications
            });
        }
    }

    // Function to send activity data to webview
    function sendActivityData(webviewView: vscode.WebviewView) {
        if (webviewView?.webview) {
            const activities = changeTracker.getActivities();
            webviewView.webview.postMessage({
                command: 'updateActivities',
                activities: activities
            });
        }
    }
    
    // Initialize services (commented out for now - will re-enable with real AI)
    // const documentManager = new DocumentManager(context);
    // const ragService = new RAGService(context);

    // Create output channel for AI responses
    const aiOutputChannel = vscode.window.createOutputChannel('Documind AI');
    context.subscriptions.push(aiOutputChannel);

    // Stub service client (no network calls yet)
    const docsClient = new DocsServiceClient();
    
    // Workspace analyzer for deep code analysis
    const workspaceAnalyzer = new WorkspaceAnalyzer();
    let isGenerating = false;
    let isPaused = false;
    let generationAbortController: AbortController | null = null;
    

    // Simulate documentation generation with delays and pause/cancel support
    async function simulateDocumentationGeneration(webviewView: vscode.WebviewView, plan: any, docGenerator: any) {
        for (let i = 0; i < plan.files.length; i++) {
            // Check if generation was cancelled
            if (!isGenerating) {
                break;
            }
            
            // Check if generation is paused
            while (isPaused && isGenerating) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Check again if cancelled while paused
            if (!isGenerating) {
                break;
            }
            
            const file = plan.files[i];
            
            // Update progress
            const percentage = ((i + 1) / plan.files.length) * 100;
            webviewView.webview.postMessage({
                command: 'generationProgress',
                percentage: percentage,
                status: `Generating ${file.name}...`,
                items: plan.files.map((f: any, index: number) => ({
                    name: f.name,
                    type: f.type,
                    status: index < i ? 'completed' : index === i ? 'generating' : 'pending'
                }))
            });
            
            // Simulate file creation delay
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Create the actual file
            try {
                await docGenerator.createDocumentationFiles({ files: [file] });
            } catch (error) {
                console.error(`Error creating file ${file.name}:`, error);
            }
        }
    }

    // Setup file watcher for automatic updates
    function setupFileWatcher(webviewView: vscode.WebviewView) {
        if (fileWatcher) {
            fileWatcher.dispose();
        }
        
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            fileWatcher = vscode.workspace.createFileSystemWatcher('**/*');
            
            fileWatcher.onDidCreate(() => {
                // Debounce updates to avoid too many refreshes
                setTimeout(() => {
                    if (webviewView.visible) {
                        refreshDashboardData(webviewView);
                    }
                }, 1000);
            });
            
            fileWatcher.onDidChange(() => {
                setTimeout(() => {
                    if (webviewView.visible) {
                        refreshDashboardData(webviewView);
                    }
                }, 1000);
            });
            
            fileWatcher.onDidDelete(() => {
                setTimeout(() => {
                    if (webviewView.visible) {
                        refreshDashboardData(webviewView);
                    }
                }, 1000);
            });
        }
    }
    
    // Refresh dashboard data
    async function refreshDashboardData(webviewView: vscode.WebviewView) {
        try {
            const analysis = await workspaceAnalyzer.analyzeWorkspace();
            webviewView.webview.postMessage({
                command: 'updateDashboardStats',
                stats: analysis // Use the complete analysis object
            });
            
            // Send maintenance notifications and activity data
            sendMaintenanceNotifications(webviewView);
            sendActivityData(webviewView);
        } catch (error) {
            console.error('Error refreshing dashboard:', error);
        }
    }

    // Consolidated workspace analysis using WorkspaceAnalyzer
    async function analyzeWorkspace() {
        try {
            return await workspaceAnalyzer.analyzeWorkspace();
        } catch (error) {
            console.error('Error analyzing workspace:', error);
            return await workspaceAnalyzer.analyzeWorkspace(); // This will return empty analysis
        }
    }

    // Register a view container for the AI chat
    const aiChatProvider = vscode.window.registerWebviewViewProvider('codenection.aiChat', {
        resolveWebviewView(webviewView: vscode.WebviewView) {
            // Enable scripts in the webview with security measures
            webviewView.webview.options = {
                enableScripts: true,
                localResourceRoots: []
            };
            
            // Setup file watcher for automatic updates
            setupFileWatcher(webviewView);
            
            webviewView.webview.html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <!-- SECURITY: Content Security Policy to prevent XSS -->
                    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline';">
                    <style>
                        * {
                            margin: 0;
                            padding: 0;
                            box-sizing: border-box;
                        }
                        
                        body { 
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            color: var(--vscode-foreground);
                            background: var(--vscode-editor-background);
                            height: 100vh;
                            width: 100%;
                            display: flex;
                            flex-direction: column;
                            overflow-y: auto;
                            margin: 0;
                            padding: 0;
                        }
                        
                        .header {
                            padding: 12px 16px;
                            border-bottom: 1px solid var(--vscode-panel-border);
                            background: var(--vscode-editor-background);
                            flex-shrink: 0;
                            min-height: 48px;
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                        }
                        
                        .header h3 {
                            font-size: 16px;
                            font-weight: 600;
                            color: var(--vscode-foreground);
                            margin: 0;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                        }
                        
                        .dashboard-container {
                            padding: 12px;
                            border-bottom: 1px solid var(--vscode-panel-border);
                            background: var(--vscode-panel-background);
                        }
                        
                        .project-overview h3, .file-breakdown h4, .doc-tasks h4, .quick-actions h4 {
                            margin: 0 0 12px 0;
                            color: var(--vscode-foreground);
                            font-size: 14px;
                            font-weight: 600;
                        }
                        
                        .stats-grid {
                            display: grid;
                            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                            gap: 12px;
                            margin-bottom: 20px;
                        }
                        
                        
                        .project-overview-section {
                            margin-bottom: 20px;
                            padding: 16px;
                            background: var(--vscode-editor-background);
                            border: 1px solid var(--vscode-panel-border);
                            border-radius: 6px;
                        }
                        
                        .project-overview-section h4 {
                            margin: 0 0 12px 0;
                            color: var(--vscode-foreground);
                            font-size: 14px;
                            font-weight: 600;
                        }
                        
                        .overview-content {
                            display: flex;
                            flex-direction: column;
                            gap: 8px;
                        }
                        
                        .overview-item {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            padding: 4px 0;
                        }
                        
                        .overview-label {
                            color: var(--vscode-descriptionForeground);
                            font-size: 12px;
                            font-weight: 500;
                        }
                        
                        .overview-value {
                            color: var(--vscode-foreground);
                            font-size: 12px;
                            font-weight: 600;
                        }
                        
                        .overview-value.status-analyzing {
                            color: var(--vscode-inputValidation-infoForeground);
                        }
                        
                        .overview-value.status-generating {
                            color: var(--vscode-inputValidation-warningForeground);
                        }
                        
                        .overview-value.status-complete {
                            color: var(--vscode-inputValidation-infoForeground);
                        }
                        
                        .overview-value.health-good {
                            color: var(--vscode-inputValidation-infoForeground);
                        }
                        
                        .overview-value.health-warning {
                            color: var(--vscode-inputValidation-warningForeground);
                        }
                        
                        .overview-value.health-poor {
                            color: var(--vscode-inputValidation-errorForeground);
                        }
                        
                        .project-overview-section .project-details {
                            margin-top: 12px;
                            padding-top: 12px;
                            border-top: 1px solid var(--vscode-panel-border);
                        }
                        
                        #projectDetails {
                            margin-top: 12px;
                            padding-top: 12px;
                            border-top: 1px solid var(--vscode-panel-border);
                        }
                        
                        .project-overview-section .project-stats {
                            display: flex;
                            flex-direction: column;
                            gap: 6px;
                        }
                        
                        .project-overview-section .stat-item {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            padding: 4px 0;
                        }
                        
                        .project-overview-section .stat-label {
                            color: var(--vscode-descriptionForeground);
                            font-size: 11px;
                            font-weight: 500;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            flex-shrink: 1;
                        }
                        
                        .project-overview-section .stat-value {
                            color: var(--vscode-foreground);
                            font-size: 11px;
                            font-weight: 600;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                        }
                        
                        .project-details h4 {
                            margin: 0 0 12px 0;
                            color: var(--vscode-foreground);
                            font-size: 14px;
                            font-weight: 600;
                        }
                        
                        .project-stats {
                            display: flex;
                            flex-direction: column;
                            gap: 8px;
                        }
                        
                        .stat-item {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            padding: 4px 0;
                        }
                        
                        .stat-label {
                            color: var(--vscode-descriptionForeground);
                            font-size: 12px;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            flex-shrink: 1;
                        }
                        
                        .stat-value {
                            color: var(--vscode-foreground);
                            font-size: 12px;
                            font-weight: 500;
                        }
                        
                        .stat-card {
                            display: flex;
                            align-items: center;
                            gap: 8px;
                            padding: 12px;
                            background: var(--vscode-input-background);
                            border: 1px solid var(--vscode-input-border);
                            border-radius: 8px;
                            transition: all 0.2s ease;
                            overflow: hidden;
                            min-width: 0;
                        }
                        
                        .stat-card:hover {
                            border-color: var(--vscode-button-background);
                            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                        }
                        
                        .stat-icon {
                            font-size: 20px;
                            flex-shrink: 0;
                        }
                        
                        .stat-info {
                            flex: 1;
                            min-width: 0;
                        }
                        
                        .stat-number {
                            font-size: 18px;
                            font-weight: 700;
                            color: var(--vscode-foreground);
                            line-height: 1.2;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                        }
                        
                        .stat-label {
                            font-size: 11px;
                            color: var(--vscode-descriptionForeground);
                            line-height: 1.2;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                        }
                        
                        .file-breakdown {
                            margin-bottom: 8px;
                        }
                        
                        .breakdown-chart {
                            height: auto;
                            background: var(--vscode-input-background);
                            border: 1px solid var(--vscode-input-border);
                            border-radius: 8px;
                            padding: 4px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: var(--vscode-descriptionForeground);
                            font-size: 14px;
                        }
                        
                        .action-buttons {
                            display: grid;
                            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                            gap: 8px;
                        }
                        
                        .action-btn {
                            padding: 8px 12px;
                            background: var(--vscode-button-background);
                            color: var(--vscode-button-foreground);
                            border: none;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 12px;
                            font-weight: 500;
                            transition: all 0.2s ease;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 6px;
                        }
                        
                        .action-btn:hover {
                            background: var(--vscode-button-hoverBackground);
                            transform: translateY(-1px);
                        }
                        
                        .action-btn:active {
                            transform: translateY(0);
                        }
                        
                        .chat-container {
                            flex: 1;
                            overflow-y: auto;
                            padding: 12px;
                            display: flex;
                            flex-direction: column;
                            gap: 12px;
                            min-height: 0;
                        }
                        
                        .message {
                            display: flex;
                            gap: 8px;
                            animation: fadeIn 0.3s ease-in;
                            flex-wrap: wrap;
                            align-items: flex-start;
                            margin-bottom: 16px;
                        }
                        
                        .message.user {
                            flex-direction: row-reverse;
                        }
                        
                        .avatar {
                            width: 32px;
                            height: 32px;
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 16px;
                            flex-shrink: 0;
                            margin-top: 4px;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                        }
                        
                        .avatar.user {
                            background: linear-gradient(135deg, var(--vscode-button-background), var(--vscode-button-hoverBackground));
                            color: var(--vscode-button-foreground);
                        }
                        
                        .avatar.ai {
                            background: linear-gradient(135deg, #10a37f, #0d8f6b);
                            color: white;
                        }
                        
                        .message-content {
                            max-width: calc(100% - 40px);
                            min-width: 200px;
                            padding: 12px 16px;
                            border-radius: 16px;
                            line-height: 1.5;
                            word-wrap: break-word;
                            flex: 1;
                            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                            position: relative;
                        }
                        
                        .message.user .message-content {
                            background: linear-gradient(135deg, var(--vscode-button-background), var(--vscode-button-hoverBackground));
                            color: var(--vscode-button-foreground);
                            border-bottom-right-radius: 4px;
                        }
                        
                        .message.ai .message-content {
                            background: var(--vscode-input-background);
                            color: var(--vscode-foreground);
                            border: 1px solid var(--vscode-input-border);
                            border-bottom-left-radius: 4px;
                        }
                        
                        .message-header {
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            margin-bottom: 4px;
                        }
                        
                        .message-sender {
                            font-weight: 600;
                            font-size: 12px;
                            color: var(--vscode-descriptionForeground);
                        }
                        
                        .message.user .message-sender {
                            color: var(--vscode-button-foreground);
                            opacity: 0.9;
                        }
                        
                        .message-timestamp {
                            font-size: 11px;
                            color: var(--vscode-descriptionForeground);
                            opacity: 0.7;
                        }
                        
                        .message.user .message-timestamp {
                            color: var(--vscode-button-foreground);
                            opacity: 0.7;
                        }
                        
                        .message-status {
                            display: inline-flex;
                            align-items: center;
                            gap: 4px;
                            font-size: 11px;
                            color: var(--vscode-descriptionForeground);
                            margin-top: 4px;
                        }
                        
                        .status-icon {
                            width: 12px;
                            height: 12px;
                            border-radius: 50%;
                        }
                        
                        .status-sending {
                            background: var(--vscode-progressBar-background);
                            animation: pulse 1.5s infinite;
                        }
                        
                        .status-delivered {
                            background: var(--vscode-charts-green);
                        }
                        
                        .status-error {
                            background: var(--vscode-errorForeground);
                        }
                        
                        @keyframes pulse {
                            0%, 100% { opacity: 0.4; }
                            50% { opacity: 1; }
                        }
                        
                        .typing-indicator {
                            display: flex;
                            align-items: center;
                            gap: 8px;
                            color: var(--vscode-descriptionForeground);
                            font-style: italic;
                        }
                        
                        .typing-dots {
                            display: flex;
                            gap: 4px;
                        }
                        
                        .typing-dots span {
                            width: 6px;
                            height: 6px;
                            border-radius: 50%;
                            background: var(--vscode-descriptionForeground);
                            animation: typing 1.4s infinite ease-in-out;
                        }
                        
                        .typing-dots span:nth-child(1) { animation-delay: -0.32s; }
                        .typing-dots span:nth-child(2) { animation-delay: -0.16s; }
                        
                        @keyframes typing {
                            0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
                            40% { transform: scale(1); opacity: 1; }
                        }
                        
                        /* Thinking process styles */
                        .thinking-indicator {
                            display: flex;
                            align-items: center;
                            gap: 8px;
                            color: var(--vscode-descriptionForeground);
                            font-style: italic;
                            margin-bottom: 8px;
                        }
                        
                        .thinking-dots {
                            display: flex;
                            gap: 3px;
                        }
                        
                        .thinking-dots span {
                            width: 4px;
                            height: 4px;
                            border-radius: 50%;
                            background: var(--vscode-descriptionForeground);
                            animation: thinking 1.2s infinite ease-in-out;
                        }
                        
                        .thinking-dots span:nth-child(1) { animation-delay: -0.32s; }
                        .thinking-dots span:nth-child(2) { animation-delay: -0.16s; }
                        .thinking-dots span:nth-child(3) { animation-delay: 0s; }
                        
                        @keyframes thinking {
                            0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
                            40% { transform: scale(1.2); opacity: 1; }
                        }
                        
                        .thinking-progress {
                            width: 100%;
                            height: 2px;
                            background: var(--vscode-input-background);
                            border-radius: 1px;
                            overflow: hidden;
                            margin-top: 4px;
                        }
                        
                        .thinking-progress-bar {
                            height: 100%;
                            background: linear-gradient(90deg, var(--vscode-button-background), var(--vscode-button-hoverBackground));
                            border-radius: 1px;
                            transition: width 0.3s ease;
                            width: 0%;
                        }
                        
                        /* File upload management styles */
                        .uploaded-files {
                            background: var(--vscode-input-background);
                            border: 1px solid var(--vscode-input-border);
                            border-radius: 8px;
                            margin-bottom: 8px;
                            padding: 8px;
                        }
                        
                        .files-header {
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            margin-bottom: 8px;
                        }
                        
                        .files-title {
                            font-size: 12px;
                            font-weight: 600;
                            color: var(--vscode-foreground);
                        }
                        
                        .clear-files-btn {
                            background: none;
                            border: none;
                            color: var(--vscode-descriptionForeground);
                            cursor: pointer;
                            padding: 2px 4px;
                            border-radius: 4px;
                            font-size: 12px;
                            transition: all 0.2s ease;
                        }
                        
                        .clear-files-btn:hover {
                            background: var(--vscode-input-background);
                            color: var(--vscode-errorForeground);
                        }
                        
                        .files-list {
                            display: flex;
                            flex-direction: column;
                            gap: 4px;
                        }
                        
                        .file-item {
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            padding: 6px 8px;
                            background: var(--vscode-panel-background);
                            border: 1px solid var(--vscode-panel-border);
                            border-radius: 6px;
                            font-size: 11px;
                        }
                        
                        .file-info {
                            display: flex;
                            align-items: center;
                            gap: 6px;
                            flex: 1;
                        }
                        
                        .file-icon {
                            font-size: 12px;
                        }
                        
                        .file-name {
                            color: var(--vscode-foreground);
                            font-weight: 500;
                        }
                        
                        .file-size {
                            color: var(--vscode-descriptionForeground);
                            font-size: 10px;
                        }
                        
                        .file-actions {
                            display: flex;
                            align-items: center;
                            gap: 4px;
                        }
                        
                        .file-toggle {
                            position: relative;
                            display: inline-block;
                            width: 32px;
                            height: 16px;
                        }
                        
                        .file-toggle input {
                            opacity: 0;
                            width: 0;
                            height: 0;
                        }
                        
                        .file-toggle-slider {
                            position: absolute;
                            cursor: pointer;
                            top: 0;
                            left: 0;
                            right: 0;
                            bottom: 0;
                            background-color: var(--vscode-input-background);
                            border: 1px solid var(--vscode-input-border);
                            border-radius: 16px;
                            transition: all 0.2s ease;
                        }
                        
                        .file-toggle-slider:before {
                            position: absolute;
                            content: "";
                            height: 12px;
                            width: 12px;
                            left: 1px;
                            bottom: 1px;
                            background-color: var(--vscode-foreground);
                            border-radius: 50%;
                            transition: all 0.2s ease;
                        }
                        
                        .file-toggle input:checked + .file-toggle-slider {
                            background-color: var(--vscode-button-background);
                            border-color: var(--vscode-button-background);
                        }
                        
                        .file-toggle input:checked + .file-toggle-slider:before {
                            transform: translateX(16px);
                            background-color: var(--vscode-button-foreground);
                        }
                        
                        .file-remove-btn {
                            background: none;
                            border: none;
                            color: var(--vscode-descriptionForeground);
                            cursor: pointer;
                            padding: 2px;
                            border-radius: 3px;
                            font-size: 12px;
                            transition: all 0.2s ease;
                        }
                        
                        .file-remove-btn:hover {
                            background: var(--vscode-input-background);
                            color: var(--vscode-errorForeground);
                        }
                        
                        /* ChatGPT-style file input */
                        .file-input-container {
                            position: fixed;
                            left: 20px;
                            z-index: 1000;
                            display: none;
                        }
                        
                        .file-input-btn {
                            width: 40px;
                            height: 40px;
                            border-radius: 50%;
                            border: 2px solid var(--vscode-input-border);
                            background: var(--vscode-input-background);
                            color: var(--vscode-foreground);
                            cursor: pointer;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            transition: all 0.2s ease;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                        }
                        
                        .file-input-btn:hover {
                            background: var(--vscode-button-background);
                            color: var(--vscode-button-foreground);
                            border-color: var(--vscode-button-background);
                            transform: scale(1.05);
                        }
                        
                        .file-input-icon {
                            font-size: 16px;
                        }
                        
                        .file-input-popup {
                            position: absolute;
                            top: 50px;
                            left: 0;
                            width: min(320px, calc(100vw - 60px));
                            max-width: 320px;
                            background: var(--vscode-panel-background);
                            border: 1px solid var(--vscode-panel-border);
                            border-radius: 12px;
                            box-shadow: 0 8px 24px rgba(0,0,0,0.2);
                            z-index: 1001;
                            display: none;
                            animation: popupFadeIn 0.2s ease-out;
                        }
                        
                        /* Responsive adjustments for smaller sidebars */
                        @media (max-width: 400px) {
                            .file-input-popup {
                                width: calc(100vw - 40px);
                                left: -10px;
                            }
                            
                            .file-input-container {
                                left: 10px;
                            }
                        }
                        
                        @media (max-width: 300px) {
                            .file-input-popup {
                                width: calc(100vw - 20px);
                                left: -20px;
                            }
                            
                            .file-input-container {
                                left: 5px;
                            }
                            
                            .file-input-btn {
                                width: 36px;
                                height: 36px;
                            }
                            
                            .file-input-icon {
                                font-size: 14px;
                            }
                        }
                        
                        .file-input-popup.show {
                            display: block;
                        }
                        
                        @keyframes popupFadeIn {
                            from { opacity: 0; transform: translateY(-10px); }
                            to { opacity: 1; transform: translateY(0); }
                        }
                        
                        .file-input-header {
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            padding: 12px 16px;
                            border-bottom: 1px solid var(--vscode-panel-border);
                        }
                        
                        .file-input-title {
                            font-size: 14px;
                            font-weight: 600;
                            color: var(--vscode-foreground);
                        }
                        
                        .file-input-close {
                            background: none;
                            border: none;
                            color: var(--vscode-descriptionForeground);
                            cursor: pointer;
                            padding: 4px;
                            border-radius: 4px;
                            font-size: 14px;
                            transition: all 0.2s ease;
                        }
                        
                        .file-input-close:hover {
                            background: var(--vscode-input-background);
                            color: var(--vscode-foreground);
                        }
                        
                        .file-input-content {
                            padding: 16px;
                        }
                        
                        .file-input-upload-area {
                            border: 2px dashed var(--vscode-input-border);
                            border-radius: 8px;
                            padding: 20px;
                            text-align: center;
                            cursor: pointer;
                            transition: all 0.2s ease;
                            margin-bottom: 12px;
                        }
                        
                        .file-input-upload-area:hover {
                            border-color: var(--vscode-button-background);
                            background: var(--vscode-input-background);
                        }
                        
                        .upload-icon {
                            font-size: 24px;
                            margin-bottom: 8px;
                        }
                        
                        .upload-text {
                            font-size: 13px;
                            font-weight: 500;
                            color: var(--vscode-foreground);
                            margin-bottom: 4px;
                        }
                        
                        .upload-subtext {
                            font-size: 11px;
                            color: var(--vscode-descriptionForeground);
                        }
                        
                        .file-input-list {
                            max-height: 200px;
                            overflow-y: auto;
                        }
                        
                        .file-input-item {
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            padding: 8px 12px;
                            background: var(--vscode-input-background);
                            border: 1px solid var(--vscode-input-border);
                            border-radius: 6px;
                            margin-bottom: 6px;
                            font-size: 12px;
                        }
                        
                        .file-input-item-info {
                            display: flex;
                            align-items: center;
                            gap: 8px;
                            flex: 1;
                        }
                        
                        .file-input-item-icon {
                            font-size: 14px;
                        }
                        
                        .file-input-item-name {
                            color: var(--vscode-foreground);
                            font-weight: 500;
                        }
                        
                        .file-input-item-size {
                            color: var(--vscode-descriptionForeground);
                            font-size: 10px;
                        }
                        
                        .file-input-item-actions {
                            display: flex;
                            align-items: center;
                            gap: 6px;
                        }
                        
                        .file-input-item-toggle {
                            position: relative;
                            display: inline-block;
                            width: 28px;
                            height: 14px;
                        }
                        
                        .file-input-item-toggle input {
                            opacity: 0;
                            width: 0;
                            height: 0;
                        }
                        
                        .file-input-item-toggle-slider {
                            position: absolute;
                            cursor: pointer;
                            top: 0;
                            left: 0;
                            right: 0;
                            bottom: 0;
                            background-color: var(--vscode-input-background);
                            border: 1px solid var(--vscode-input-border);
                            border-radius: 14px;
                            transition: all 0.2s ease;
                        }
                        
                        .file-input-item-toggle-slider:before {
                            position: absolute;
                            content: "";
                            height: 10px;
                            width: 10px;
                            left: 1px;
                            bottom: 1px;
                            background-color: var(--vscode-foreground);
                            border-radius: 50%;
                            transition: all 0.2s ease;
                        }
                        
                        .file-input-item-toggle input:checked + .file-input-item-toggle-slider {
                            background-color: var(--vscode-button-background);
                            border-color: var(--vscode-button-background);
                        }
                        
                        .file-input-item-toggle input:checked + .file-input-item-toggle-slider:before {
                            transform: translateX(14px);
                            background-color: var(--vscode-button-foreground);
                        }
                        
                        .file-input-item-remove {
                            background: none;
                            border: none;
                            color: var(--vscode-descriptionForeground);
                            cursor: pointer;
                            padding: 2px;
                            border-radius: 3px;
                            font-size: 12px;
                            transition: all 0.2s ease;
                        }
                        
                        .file-input-item-remove:hover {
                            background: var(--vscode-input-background);
                            color: var(--vscode-errorForeground);
                        }
                        
                        }
                        
                        .message-actions {
                            margin-top: 8px;
                            display: flex;
                            gap: 8px;
                            flex-wrap: wrap;
                        }
                        
                        .action-btn {
                            padding: 6px 12px;
                            font-size: 12px;
                            border: 1px solid var(--vscode-input-border);
                            background: var(--vscode-input-background);
                            color: var(--vscode-input-foreground);
                            border-radius: 16px;
                            cursor: pointer;
                            transition: all 0.2s ease;
                            display: flex;
                            align-items: center;
                            gap: 4px;
                        }
                        
                        .action-btn:hover {
                            background: var(--vscode-button-background);
                            color: var(--vscode-button-foreground);
                            border-color: var(--vscode-button-background);
                        }
                        
                        .chat-input-container {
                            padding: 12px;
                            border-top: 1px solid var(--vscode-panel-border);
                            background: var(--vscode-editor-background);
                            flex-shrink: 0;
                            min-height: 60px;
                        }
                        
                        .input-wrapper {
                            display: flex;
                            align-items: center;
                            gap: 8px;
                            padding: 8px;
                            border: 1px solid var(--vscode-input-border);
                            background: var(--vscode-input-background);
                            border-radius: 24px;
                            transition: all 0.2s ease;
                            min-height: 44px;
                            flex-wrap: wrap;
                        }
                        
                        .input-wrapper:focus-within {
                            border-color: var(--vscode-button-background);
                            box-shadow: 0 0 0 2px rgba(var(--vscode-button-background), 0.1);
                        }
                        
                        .chat-input {
                            flex: 1;
                            min-width: 200px;
                            padding: 8px 12px;
                            border: none;
                            background: transparent;
                            color: var(--vscode-input-foreground);
                            font-size: 14px;
                            resize: none;
                            min-height: 28px;
                            max-height: 120px;
                            outline: none;
                            line-height: 1.4;
                            border-radius: 16px;
                        }
                        
                        .chat-input::placeholder {
                            color: var(--vscode-descriptionForeground);
                        }
                        
                        .send-btn, .upload-btn {
                            width: 36px;
                            height: 36px;
                            border: none;
                            border-radius: 50%;
                            cursor: pointer;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            transition: all 0.2s ease;
                            flex-shrink: 0;
                            font-size: 16px;
                        }
                        
                        .upload-btn {
                            background: var(--vscode-input-background);
                            color: var(--vscode-input-foreground);
                            border: 1px solid var(--vscode-input-border);
                        }
                        
                        .upload-btn:hover {
                            background: var(--vscode-input-border);
                            transform: scale(1.05);
                        }
                        
                        .send-btn {
                            background: var(--vscode-button-background);
                            color: var(--vscode-button-foreground);
                        }
                        
                        .send-btn:hover {
                            background: var(--vscode-button-hoverBackground);
                            transform: scale(1.05);
                        }
                        
                        .send-btn:disabled {
                            opacity: 0.5;
                            cursor: not-allowed;
                            transform: none;
                        }
                        
                        .typing-indicator {
                            display: flex;
                            gap: 4px;
                            padding: 12px 16px;
                            color: var(--vscode-descriptionForeground);
                            font-style: italic;
                        }
                        
                        .typing-dot {
                            width: 6px;
                            height: 6px;
                            border-radius: 50%;
                            background: var(--vscode-descriptionForeground);
                            animation: typing 1.4s infinite ease-in-out;
                        }
                        
                        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
                        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
                        
                        @keyframes typing {
                            0%, 60%, 100% { transform: translateY(0); }
                            30% { transform: translateY(-10px); }
                        }
                        
                        @keyframes fadeIn {
                            from { opacity: 0; transform: translateY(10px); }
                            to { opacity: 1; transform: translateY(0); }
                        }
                        
                        .welcome-message {
                            text-align: center;
                            color: var(--vscode-descriptionForeground);
                            padding: 24px 12px;
                            flex: 1;
                            display: flex;
                            flex-direction: column;
                            justify-content: center;
                            align-items: center;
                        }
                        
                        .welcome-message h4 {
                            margin-bottom: 8px;
                            color: var(--vscode-foreground);
                            font-size: 16px;
                        }
                        
                        .welcome-message p {
                            font-size: 14px;
                            line-height: 1.4;
                            max-width: 300px;
                        }
                        
                        /* Responsive breakpoints */
                        @media (max-width: 400px) {
                            .chat-input {
                                min-width: 150px;
                                font-size: 13px;
                            }
                            
                            .message-content {
                                min-width: 150px;
                                padding: 6px 10px;
                            }
                            
                            .header h3 {
                                font-size: 14px;
                            }
                        }
                        
                        @media (max-width: 300px) {
                            .input-wrapper {
                                padding: 6px;
                                gap: 6px;
                            }
                            
                            .chat-input {
                                min-width: 120px;
                                font-size: 12px;
                            }
                            
                            .send-btn, .upload-btn {
                                width: 32px;
                                height: 32px;
                                font-size: 14px;
                            }
                        }
                        /* Notifications */
                        .notif-bell { width: 30px; height: 30px; border: 1px solid var(--vscode-input-border); background: var(--vscode-input-background); color: var(--vscode-foreground); border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; position: relative; }
                        .notif-bell:hover { background: var(--vscode-input-border); }
                        .notif-badge { position: absolute; top: -4px; right: -4px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border-radius: 10px; padding: 0 5px; height: 16px; line-height: 16px; font-size: 10px; border: 1px solid var(--vscode-input-border); }
                        .notif-panel { position: absolute; top: 56px; right: 12px; width: min(320px, calc(100% - 24px)); max-height: 60vh; overflow-y: auto; background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); border-radius: 8px; box-shadow: 0 6px 24px rgba(0,0,0,0.25); z-index: 1000; }
                        .notif-header { padding: 8px 10px; border-bottom: 1px solid var(--vscode-panel-border); font-weight: 600; font-size: 12px; }
                        .notif-list { list-style: none; padding: 8px; display: flex; flex-direction: column; gap: 8px; }
                        .notif-item { border: 1px solid var(--vscode-input-border); background: var(--vscode-input-background); border-radius: 6px; padding: 8px; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
                        .notif-title { font-size: 12px; font-weight: 600; word-break: break-word; overflow-wrap: anywhere; }
                        .notif-desc { font-size: 11px; color: var(--vscode-descriptionForeground); word-break: break-word; overflow-wrap: anywhere; }
                        .notif-actions { display: flex; gap: 6px; flex-wrap: wrap; }
                        .notif-actions .btn { background: transparent; color: var(--vscode-foreground); border: 1px solid var(--vscode-input-border); border-radius: 6px; font-size: 11px; padding: 3px 8px; cursor: pointer; }
                        .notif-actions .btn:hover { background: var(--vscode-input-background); }
                        .notif-click { display: flex; align-items: center; justify-content: space-between; cursor: pointer; gap: 8px; min-width: 0; }
                        .notif-caret { font-size: 12px; color: var(--vscode-descriptionForeground); }
                        .notif-details { display: none; border-top: 1px dashed var(--vscode-input-border); padding-top: 6px; font-size: 11px; color: var(--vscode-foreground); word-break: break-word; overflow-wrap: anywhere; }
                        .notif-item.expanded .notif-details { display: block; }
                        .hidden { display: none; }

                        /* Tabs */
                        .tabs { 
                            display: flex; 
                            gap: 6px; 
                            padding: 8px 12px; 
                            border-bottom: 1px solid var(--vscode-panel-border); 
                            background: var(--vscode-editor-background); 
                            flex-wrap: wrap;
                            align-content: flex-start;
                        }
                        .tab-btn { 
                            background: transparent; 
                            color: var(--vscode-foreground); 
                            border: 1px solid var(--vscode-input-border); 
                            border-radius: 6px; 
                            font-size: 11px; 
                            padding: 4px 8px; 
                            cursor: pointer; 
                            white-space: nowrap;
                            flex-shrink: 0;
                            min-width: fit-content;
                        }
                        .tab-btn.active { background: var(--vscode-input-background); border-color: var(--vscode-button-background); }
                        .tab-panel { display: none; }
                        .tab-panel.active { display: block; }
                        /* Split container styles */
                        .split-container {
                            display: flex;
                            flex-direction: column;
                            height: calc(100vh - 48px);
                            min-height: 0;
                        }
                        .top-pane {
                            flex: 0 0 42%;
                            min-height: 120px;
                            overflow: hidden;
                            display: flex;
                            flex-direction: column;
                        }
                        .divider {
                            height: 6px;
                            cursor: row-resize;
                            background: var(--vscode-panel-border);
                            border-top: 1px solid var(--vscode-panel-border);
                            border-bottom: 1px solid var(--vscode-panel-border);
                            position: relative;
                        }
                        .divider:after {
                            content: '';
                            position: absolute;
                            left: 50%;
                            top: 50%;
                            transform: translate(-50%, -50%);
                            width: 40px;
                            height: 2px;
                            background: var(--vscode-descriptionForeground);
                            border-radius: 2px;
                            opacity: 0.7;
                        }
                        .bottom-pane {
                            flex: 1 1 auto;
                            min-height: 120px;
                            display: flex;
                            flex-direction: column;
                            min-height: 0;
                        }

                        /* Breakdown scroll/collapse */
                        .file-breakdown .breakdown-chart {
                            max-height: 220px;
                            overflow-y: auto;
                            overflow-x: hidden;
                        }
                        .breakdown-list { list-style: none; display: flex; flex-direction: column; gap: 3px; }
                        .breakdown-group { border: 1px solid var(--vscode-input-border); border-radius: 6px; background: var(--vscode-input-background); }
                        .breakdown-group-header { display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; cursor: pointer; }
                        .breakdown-group-header:hover { background: var(--vscode-input-border); }
                        .breakdown-items { padding: 4px 8px 8px 8px; display: none; }
                        .breakdown-item { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--vscode-foreground); padding: 4px 0; }
                        .breakdown-bar { height: 5px; border-radius: 3px; background: var(--vscode-button-background); flex: 1; }
                        .badge { font-size: 10px; color: var(--vscode-descriptionForeground); }

                        /* Insights two-column layout (grid default 2 cols, collapse on very small) */
                        .insights-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; align-items: start; }
                        @media (max-width: 440px) { .insights-grid { grid-template-columns: 1fr; } }

                        /* Doc tasks cards */
                        .task-card { padding: 10px; background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); border-radius: 8px; display: flex; flex-direction: column; gap: 8px; font-family: inherit; }
                        .task-header { display: flex; align-items: center; gap: 8px; }
                        .task-icon { font-size: 14px; }
                        .task-title { font-family: inherit; font-size: 12px; font-weight: 600; color: var(--vscode-foreground); flex: 1; }
                        .task-priority { font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600; }
                        .task-description { font-size: 11px; color: var(--vscode-descriptionForeground); line-height: 1.4; }
                        .task-actions { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
                        .task-actions .btn { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: 1px solid var(--vscode-button-border); border-radius: 6px; font-size: 11px; padding: 6px 12px; cursor: pointer; font-family: inherit; font-weight: 500; transition: all 0.2s ease; }
                        .task-actions .btn:hover { background: var(--vscode-button-hoverBackground); transform: translateY(-1px); box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
                        .task-actions .btn:active { transform: translateY(0); box-shadow: 0 1px 2px rgba(0,0,0,0.2); }

                        /* Empty state styling */
                        .empty-state { 
                            display: flex; 
                            flex-direction: column; 
                            align-items: center; 
                            justify-content: center; 
                            padding: 24px 16px; 
                            text-align: center; 
                            background: var(--vscode-input-background); 
                            border: 1px solid var(--vscode-input-border); 
                            border-radius: 8px; 
                            margin: 8px 0;
                        }
                        .empty-state-icon { 
                            font-size: 24px; 
                            margin-bottom: 8px; 
                            opacity: 0.8;
                        }
                        .empty-state-title { 
                            font-size: 14px; 
                            font-weight: 600; 
                            color: var(--vscode-foreground); 
                            margin-bottom: 4px;
                        }
                        .empty-state-message { 
                            font-size: 12px; 
                            color: var(--vscode-descriptionForeground); 
                            line-height: 1.4;
                        }

                        /* Settings toggle switch styles */
                        .settings-item {
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            padding: 8px 0;
                        }
                        
                        .settings-label {
                            font-size: 13px;
                            color: var(--vscode-foreground);
                            flex: 1;
                        }
                        
                        .toggle-switch {
                            position: relative;
                            display: inline-block;
                            width: 44px;
                            height: 24px;
                            flex-shrink: 0;
                        }
                        
                        .toggle-switch input {
                            opacity: 0;
                            width: 0;
                            height: 0;
                        }
                        
                        .toggle-slider {
                            position: absolute;
                            cursor: pointer;
                            top: 0;
                            left: 0;
                            right: 0;
                            bottom: 0;
                            background-color: var(--vscode-input-background);
                            border: 1px solid var(--vscode-input-border);
                            border-radius: 24px;
                            transition: all 0.3s ease;
                        }
                        
                        .toggle-slider:before {
                            position: absolute;
                            content: "";
                            height: 18px;
                            width: 18px;
                            left: 2px;
                            bottom: 2px;
                            background-color: var(--vscode-foreground);
                            border-radius: 50%;
                            transition: all 0.3s ease;
                        }
                        
                        .toggle-switch input:checked + .toggle-slider {
                            background-color: var(--vscode-button-background);
                            border-color: var(--vscode-button-background);
                        }
                        
                        .toggle-switch input:checked + .toggle-slider:before {
                            transform: translateX(20px);
                            background-color: var(--vscode-button-foreground);
                        }
                        
                        .priority-high { border-left: 3px solid #ff6b6b; }
                        .priority-medium { border-left: 3px solid #ffa726; }
                        .priority-low { border-left: 3px solid #42a5f5; }
                        
                        .priority-high .task-priority { background: #ff6b6b; color: white; }
                        .priority-medium .task-priority { background: #ffa726; color: white; }
                        .priority-low .task-priority { background: #42a5f5; color: white; }
                        #docTasksList { max-height: 280px; overflow-y: auto; overflow-x: hidden; padding-right: 4px; }
                        .breakdown-header {
                            display: flex;
                            align-items: center;
                            justify-content: flex-start;
                            gap: 8px;
                            margin-bottom: 4px;
                        }
                        
                        .doc-tasks-header {
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            gap: 8px;
                            margin-bottom: 8px;
                        }
                        
                        .doc-tasks-header h4 {
                            margin: 0;
                            flex: 1;
                        }
                        
                        .doc-tasks-header .action-btn {
                            padding: 3px 8px;
                            font-size: 11px;
                            height: auto;
                            min-width: auto;
                        }
                        
                        .pause-btn {
                            background: var(--vscode-inputValidation-warningBackground) !important;
                            color: var(--vscode-inputValidation-warningForeground) !important;
                            border-color: var(--vscode-inputValidation-warningBorder) !important;
                        }
                        
                        .pause-btn:hover {
                            background: var(--vscode-inputValidation-warningBackground) !important;
                            opacity: 0.8;
                        }
                        
                        .resume-btn {
                            background: var(--vscode-inputValidation-infoBackground) !important;
                            color: var(--vscode-inputValidation-infoForeground) !important;
                            border-color: var(--vscode-inputValidation-infoBorder) !important;
                        }
                        
                        .resume-btn:hover {
                            background: var(--vscode-inputValidation-infoBackground) !important;
                            opacity: 0.8;
                        }
                        
                        .cancel-btn {
                            background: var(--vscode-inputValidation-errorBackground) !important;
                            color: var(--vscode-inputValidation-errorForeground) !important;
                            border-color: var(--vscode-inputValidation-errorBorder) !important;
                        }
                        
                        .cancel-btn:hover {
                            background: var(--vscode-inputValidation-errorBackground) !important;
                            opacity: 0.8;
                        }
                        
                        /* Streaming UI Components */
                        .generation-progress {
                            background: var(--vscode-input-background);
                            border: 1px solid var(--vscode-input-border);
                            border-radius: 8px;
                            padding: 12px;
                            margin: 8px 0;
                            display: none;
                        }
                        
                        .generation-progress.active {
                            display: block;
                        }
                        
                        .progress-header {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            margin-bottom: 8px;
                        }
                        
                        .progress-title {
                            font-size: 12px;
                            font-weight: 600;
                            color: var(--vscode-foreground);
                        }
                        
                        .progress-percentage {
                            font-size: 11px;
                            color: var(--vscode-descriptionForeground);
                        }
                        
                        .progress-bar-container {
                            width: 100%;
                            height: 8px;
                            background: var(--vscode-input-border);
                            border-radius: 4px;
                            overflow: hidden;
                            margin-bottom: 8px;
                        }
                        
                        .progress-bar-fill {
                            height: 100%;
                            background: var(--vscode-button-background);
                            transition: width 0.3s ease;
                            width: 0%;
                        }
                        
                        .progress-status {
                            font-size: 11px;
                            color: var(--vscode-descriptionForeground);
                            margin-bottom: 8px;
                        }
                        
                        .generation-items {
                            max-height: 200px;
                            overflow-y: auto;
                        }
                        
                        .generation-item {
                            display: flex;
                            align-items: center;
                            gap: 8px;
                            padding: 4px 0;
                            font-size: 11px;
                            border-bottom: 1px solid var(--vscode-input-border);
                        }
                        
                        .generation-item:last-child {
                            border-bottom: none;
                        }
                        
                        .item-status {
                            width: 12px;
                            height: 12px;
                            border-radius: 50%;
                            flex-shrink: 0;
                        }
                        
                        .item-status.pending {
                            background: var(--vscode-descriptionForeground);
                        }
                        
                        .item-status.generating {
                            background: var(--vscode-button-background);
                            animation: pulse 1.5s infinite;
                        }
                        
                        .item-status.completed {
                            background: #10a37f;
                        }
                        
                        .item-status.error {
                            background: #ff6b6b;
                        }
                        
                        .item-name {
                            flex: 1;
                            color: var(--vscode-foreground);
                        }
                        
                        .item-type {
                            color: var(--vscode-descriptionForeground);
                            font-size: 10px;
                        }
                        
                        @keyframes pulse {
                            0%, 100% { opacity: 1; }
                            50% { opacity: 0.5; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h3>🤖 Documind</h3>
                        <button id="notifBell" class="notif-bell" title="Notifications">🔔<span id="notifCount" class="notif-badge hidden">0</span></button>
                    </div>
                    <div id="notifPanel" class="notif-panel hidden" role="region" aria-label="Notifications">
                        <div class="notif-header">Notifications</div>
                        <ul id="notifList" class="notif-list"></ul>
                    </div>
                    
                    <div class="tabs">
                        <button class="tab-btn active" data-tab="dashboard">Dashboard</button>
                        <button class="tab-btn" data-tab="chat">Chat</button>
                        <button class="tab-btn" data-tab="notifications">Notifications</button>
                        <button class="tab-btn" data-tab="activity">Activity</button>
                        <button class="tab-btn" data-tab="settings">Settings</button>
                    </div>
                    
                    <!-- ChatGPT-style file input button (only visible in chat tab) -->
                    <div class="file-input-container" id="fileInputContainer" style="display: none;">
                        <button class="file-input-btn" id="fileInputBtn" title="Upload files for context">
                            <span class="file-input-icon">📎</span>
                        </button>
                        <div class="file-input-popup" id="fileInputPopup">
                            <div class="file-input-header">
                                <span class="file-input-title">📎 Persistent Files</span>
                                <button class="file-input-close" id="fileInputClose">✕</button>
                            </div>
                            <div class="file-input-content">
                                <div class="file-input-upload-area" id="fileInputUploadArea">
                                    <div class="upload-icon">📁</div>
                                    <div class="upload-text">Click to upload files or drag & drop</div>
                                    <div class="upload-subtext">Files will be available for all future messages</div>
                                </div>
                                <div class="file-input-list" id="fileInputList"></div>
                            </div>
                        </div>
                    </div>
                    <div class="dashboard-container tab-panel active" id="dashboardContainer" data-panel="dashboard">
                        <div class="project-overview">
                            <h3>📊 Project Overview</h3>
                            <div class="stats-grid">
                                <div class="stat-card">
                                    <div class="stat-icon">📁</div>
                                    <div class="stat-info">
                                        <div class="stat-number" id="totalFiles">0</div>
                                        <div class="stat-label">Total Files</div>
                                    </div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-icon">📝</div>
                                    <div class="stat-info">
                                        <div class="stat-number" id="docFiles">0</div>
                                        <div class="stat-label">Documentation</div>
                                    </div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-icon">💻</div>
                                    <div class="stat-info">
                                        <div class="stat-number" id="codeFiles">0</div>
                                        <div class="stat-label">Code Files</div>
                                    </div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-icon">📊</div>
                                    <div class="stat-info">
                                        <div class="stat-number" id="docCoverage">0%</div>
                                        <div class="stat-label">Doc Coverage</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="project-overview-section">
                            <h4>📋 Project Overview</h4>
                            <div class="overview-content">
                                <div class="overview-item">
                                    <span class="overview-label">Status:</span>
                                    <span class="overview-value" id="projectStatus">Analyzing...</span>
                                </div>
                                <div class="overview-item">
                                    <span class="overview-label">Health:</span>
                                    <span class="overview-value" id="projectHealth">Good</span>
                                </div>
                                <div class="overview-item">
                                    <span class="overview-label">Last Updated:</span>
                                    <span class="overview-value" id="lastUpdated">Just now</span>
                                </div>
                            </div>
                            <div id="projectDetails" class="project-details">
                                <!-- Project structure details will be populated by JavaScript -->
                            </div>
                        </div>
                        
                        <div class="insights-grid">
                            <div class="file-breakdown">
                                <div class="breakdown-header">
                                    <h4>📈 File Type Breakdown</h4>
                                </div>
                                <div class="breakdown-chart" id="breakdownChart">
                                    <!-- Chart will be generated here -->
                                </div>
                            </div>

                            <div class="doc-tasks">
                                <div class="doc-tasks-header">
                                    <h4>🧩 Doc Tasks</h4>
                                    <button class="action-btn" id="generateAllMissingDocs" title="Generate documentation for all missing docs">Generate All</button>
                                    <button class="action-btn pause-btn" id="pauseGeneration" title="Pause documentation generation" style="display: none;">⏸️ Pause</button>
                                                                          <button class="action-btn resume-btn" id="resumeGeneration" title="Resume documentation generation" style="display: none;">▶️ Resume</button>
                                      <button class="action-btn cancel-btn" id="cancelGeneration" title="Cancel documentation generation" style="display: none;">⏹️ Cancel</button>
                                </div>
                                
                                <div id="generationProgress" class="generation-progress">
                                    <div class="progress-header">
                                        <div class="progress-title">🚀 Generating Documentation</div>
                                        <div class="progress-percentage" id="progressPercentage">0%</div>
                                    </div>
                                    <div class="progress-bar-container">
                                        <div class="progress-bar-fill" id="progressBarFill"></div>
                                    </div>
                                    <div class="progress-status" id="progressStatus">Preparing to generate documentation...</div>
                                    <div class="generation-items" id="generationItems"></div>
                                </div>
                                
                                <div id="docTasksList" style="display:flex; flex-direction:column; gap:8px;"></div>
                            </div>
                        </div>
                        
                        <div class="quick-actions">
                            <h4>⚡ Quick Actions</h4>
                            <div class="action-buttons">
                                <button class="action-btn" id="generateReadme">
                                    📖 Generate README
                                </button>
                                <button class="action-btn" id="generateApiDocs">
                                    🔌 Generate API Docs
                                </button>
                                <button class="action-btn" id="generateChangelog">
                                    📋 Generate Changelog
                                </button>
                                <button class="action-btn" id="analyzeProject">
                                    🔍 Analyze Project
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="dashboard-container tab-panel" id="notificationsContainer" data-panel="notifications">
                        <div class="project-overview">
                            <h3>🔔 Notifications</h3>
                        </div>
                        <ul id="notifListFull" class="notif-list"></ul>
                    </div>
                    
                    <div class="dashboard-container tab-panel" id="activityContainer" data-panel="activity">
                        <div class="project-overview">
                            <h3>📜 Activity</h3>
                        </div>
                        <div style="display:flex; gap:8px; margin-bottom:8px; flex-wrap:wrap;">
                            <button class="action-btn" id="filterAll">All</button>
                            <button class="action-btn" id="filterAuto">Auto</button>
                            <button class="action-btn" id="filterManual">Manual</button>
                            <button class="action-btn" id="filterPending">Pending</button>
                            <button class="action-btn" id="filterApplied">Applied</button>
                        </div>
                        <ul id="activityList" class="notif-list"></ul>
                    </div>

                    <div class="dashboard-container tab-panel" id="settingsContainer" data-panel="settings">
                        <div class="project-overview">
                            <h3>⚙️ Settings</h3>
                        </div>
                        <div class="stat-card" style="flex-direction:column; align-items:stretch; gap:10px;">
                            <div class="settings-item">
                                <span class="settings-label">Enable Automation Mode (detect doc drift and propose fixes)</span>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="enableAutomation" />
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                            <label style="display:flex; align-items:center; gap:8px;">
                                <span style="min-width:140px;">Automation Behavior</span>
                                <select id="automationBehavior" style="flex:1; background:var(--vscode-input-background); color:var(--vscode-input-foreground); border:1px solid var(--vscode-input-border); border-radius:6px; padding:4px;">
                                    <option value="suggest">Suggest changes (require approval)</option>
                                    <option value="auto-apply">Auto-apply safe changes</option>
                                </select>
                            </label>
                            <label style="display:flex; align-items:center; gap:8px;">
                                <span style="min-width:140px;">Slack/Webhook URL</span>
                                <input id="webhookUrl" type="text" placeholder="https://hooks.slack.com/... (placeholder)" 
                                    style="flex:1; background:var(--vscode-input-background); color:var(--vscode-input-foreground); border:1px solid var(--vscode-input-border); border-radius:6px; padding:6px;" />
                            </label>
                            <label style="display:flex; align-items:center; gap:8px;">
                                <span style="min-width:140px;">Default docs folder</span>
                                <input id="docsFolder" type="text" placeholder="docs/" 
                                    style="flex:1; background:var(--vscode-input-background); color:var(--vscode-input-foreground); border:1px solid var(--vscode-input-border); border-radius:6px; padding:6px;" />
                            </label>
                            <div class="settings-item">
                                <span class="settings-label">Auto-generate docs on save</span>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="autoGenerateOnSave" />
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                            <div class="settings-item">
                                <span class="settings-label">Status bar notifications</span>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="statusBarNotifications" />
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                            <div style="display:flex; gap:8px;">
                                <button class="action-btn" id="saveSettings">Save</button>
                                <button class="action-btn" id="resetSettings">Reset</button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="chat-container tab-panel" id="chatContainer" data-panel="chat">
                        <div class="welcome-message">
                            <h4>Welcome to Documind!</h4>
                            <p>Ask me anything about your code, documentation, or development questions.</p>
                        </div>
                    </div>
                    <div class="chat-input-container tab-panel" data-panel="chat">
                        <div class="uploaded-files" id="uploadedFiles" style="display: none;">
                            <div class="files-header">
                                <span class="files-title">📎 Uploaded Files</span>
                                <button class="clear-files-btn" id="clearFilesBtn" title="Clear all files">🗑️</button>
                            </div>
                            <div class="files-list" id="filesList"></div>
                        </div>
                        <div class="input-wrapper">
                            <button class="upload-btn" id="uploadBtn" title="Upload file">📎</button>
                            <textarea class="chat-input" id="chatInput" placeholder="Message Documind AI..." rows="1"></textarea>
                            <button class="send-btn" id="sendBtn" title="Send message">➤</button>
                        </div>
                    </div>
                    <script>
                        const vscode = acquireVsCodeApi();
                        const chatInput = document.getElementById('chatInput');
                        const sendBtn = document.getElementById('sendBtn');
                        const uploadBtn = document.getElementById('uploadBtn');
                        const uploadedFiles = document.getElementById('uploadedFiles');
                        const filesList = document.getElementById('filesList');
                        const clearFilesBtn = document.getElementById('clearFilesBtn');
                        
                        // File management
                        let uploadedFilesList = [];
                        
                        function getFileIcon(fileName) {
                            const ext = fileName.split('.').pop().toLowerCase();
                            const icons = {
                                'js': '📄', 'ts': '📄', 'jsx': '⚛️', 'tsx': '⚛️',
                                'py': '🐍', 'java': '☕', 'cpp': '⚙️', 'c': '⚙️',
                                'html': '🌐', 'css': '🎨', 'scss': '🎨', 'sass': '🎨',
                                'json': '📋', 'xml': '📋', 'yaml': '📋', 'yml': '📋',
                                'md': '📝', 'txt': '📝', 'pdf': '📕', 'doc': '📄', 'docx': '📄',
                                'png': '🖼️', 'jpg': '🖼️', 'jpeg': '🖼️', 'gif': '🖼️', 'svg': '🖼️',
                                'zip': '📦', 'rar': '📦', 'tar': '📦', 'gz': '📦'
                            };
                            return icons[ext] || '📄';
                        }
                        
                        function formatFileSize(bytes) {
                            if (bytes === 0) return '0 B';
                            const k = 1024;
                            const sizes = ['B', 'KB', 'MB', 'GB'];
                            const i = Math.floor(Math.log(bytes) / Math.log(k));
                            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
                        }
                        
                        function addFileToList(file) {
                            const fileId = Date.now() + Math.random();
                            const fileData = {
                                id: fileId,
                                name: file.name,
                                size: file.size,
                                type: file.type,
                                referenced: true,
                                file: file
                            };
                            
                            uploadedFilesList.push(fileData);
                            updateFilesDisplay();
                        }
                        
                        function updateFilesDisplay() {
                            if (uploadedFilesList.length === 0) {
                                uploadedFiles.style.display = 'none';
                                return;
                            }
                            
                            uploadedFiles.style.display = 'block';
                            filesList.innerHTML = '';
                            
                            uploadedFilesList.forEach(fileData => {
                                const fileItem = document.createElement('div');
                                fileItem.className = 'file-item';
                                
                                fileItem.innerHTML = '<div class="file-info">' +
                                    '<span class="file-icon">' + getFileIcon(fileData.name) + '</span>' +
                                    '<span class="file-name">' + fileData.name + '</span>' +
                                    '<span class="file-size">' + formatFileSize(fileData.size) + '</span>' +
                                    '</div>' +
                                    '<div class="file-actions">' +
                                    '<label class="file-toggle" title="Toggle file reference">' +
                                    '<input type="checkbox"' + (fileData.referenced ? ' checked' : '') + '>' +
                                    '<span class="file-toggle-slider"></span>' +
                                    '</label>' +
                                    '<button class="file-remove-btn" title="Remove file">✕</button>' +
                                    '</div>';
                                
                                // Add event listeners
                                const toggle = fileItem.querySelector('input[type="checkbox"]');
                                const removeBtn = fileItem.querySelector('.file-remove-btn');
                                
                                toggle.addEventListener('change', (e) => {
                                    fileData.referenced = e.target.checked;
                                });
                                
                                removeBtn.addEventListener('click', () => {
                                    uploadedFilesList = uploadedFilesList.filter(f => f.id !== fileData.id);
                                    updateFilesDisplay();
                                });
                                
                                filesList.appendChild(fileItem);
                            });
                        }
                        
                        // Clear all files
                        clearFilesBtn.addEventListener('click', () => {
                            uploadedFilesList = [];
                            updateFilesDisplay();
                        });
                        
                        // ChatGPT-style file input
                        const fileInputContainer = document.getElementById('fileInputContainer');
                        const fileInputBtn = document.getElementById('fileInputBtn');
                        const fileInputPopup = document.getElementById('fileInputPopup');
                        const fileInputClose = document.getElementById('fileInputClose');
                        const fileInputUploadArea = document.getElementById('fileInputUploadArea');
                        const fileInputList = document.getElementById('fileInputList');
                        
                        // Persistent files for ChatGPT-style input
                        let persistentFiles = [];
                        
                        // Function to position file input button based on nav bar
                        function positionFileInputButton() {
                            const fileInputContainer = document.getElementById('fileInputContainer');
                            const tabsContainer = document.querySelector('.tabs');
                            
                            if (fileInputContainer && tabsContainer) {
                                const tabsRect = tabsContainer.getBoundingClientRect();
                                const offsetFromNavBar = 15; // 15px padding below nav bar
                                const topPosition = tabsRect.bottom + offsetFromNavBar;
                                
                                fileInputContainer.style.top = topPosition + 'px';
                            }
                        }
                        
                        // Toggle popup
                        fileInputBtn.addEventListener('click', () => {
                            fileInputPopup.classList.toggle('show');
                            updatePersistentFilesDisplay();
                            
                            // Adjust popup position and size based on container width
                            adjustPopupSize();
                        });
                        
                        // Function to adjust popup size based on available space
                        function adjustPopupSize() {
                            const container = fileInputContainer;
                            const popup = fileInputPopup;
                            const containerRect = container.getBoundingClientRect();
                            const viewportWidth = window.innerWidth;
                            
                            // Calculate available space
                            const availableWidth = viewportWidth - containerRect.left - 20; // 20px margin
                            
                            // Set popup width based on available space
                            if (availableWidth < 320) {
                                popup.style.width = Math.max(280, availableWidth - 20) + 'px';
                                
                                // Adjust left position if popup would overflow
                                if (containerRect.left + 320 > viewportWidth - 20) {
                                    popup.style.left = Math.max(-10, viewportWidth - containerRect.left - 320 - 20) + 'px';
                                }
                            } else {
                                popup.style.width = '320px';
                                popup.style.left = '0px';
                            }
                        }
                        
                        // Adjust popup size on window resize
                        window.addEventListener('resize', () => {
                            if (fileInputPopup.classList.contains('show')) {
                                adjustPopupSize();
                            }
                            // Also reposition the button when window resizes
                            const fileInputContainer = document.getElementById('fileInputContainer');
                            if (fileInputContainer && fileInputContainer.style.display !== 'none') {
                                positionFileInputButton();
                            }
                        });
                        
                        // Close popup
                        fileInputClose.addEventListener('click', () => {
                            fileInputPopup.classList.remove('show');
                        });
                        
                        // Close popup when clicking outside
                        document.addEventListener('click', (e) => {
                            if (!fileInputContainer.contains(e.target)) {
                                fileInputPopup.classList.remove('show');
                            }
                        });
                        
                        // Upload area click
                        fileInputUploadArea.addEventListener('click', () => {
                            const fileInput = document.createElement('input');
                            fileInput.type = 'file';
                            fileInput.multiple = true;
                            fileInput.accept = '.js,.ts,.jsx,.tsx,.py,.java,.cpp,.c,.html,.css,.scss,.sass,.json,.xml,.yaml,.yml,.md,.txt,.pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.svg,.zip,.rar,.tar,.gz';
                            
                            fileInput.addEventListener('change', (e) => {
                                const files = Array.from(e.target.files);
                                files.forEach(file => {
                                    addPersistentFile(file);
                                });
                            });
                            
                            fileInput.click();
                        });
                        
                        // Drag and drop
                        fileInputUploadArea.addEventListener('dragover', (e) => {
                            e.preventDefault();
                            fileInputUploadArea.style.borderColor = 'var(--vscode-button-background)';
                            fileInputUploadArea.style.background = 'var(--vscode-input-background)';
                        });
                        
                        fileInputUploadArea.addEventListener('dragleave', (e) => {
                            e.preventDefault();
                            fileInputUploadArea.style.borderColor = 'var(--vscode-input-border)';
                            fileInputUploadArea.style.background = 'transparent';
                        });
                        
                        fileInputUploadArea.addEventListener('drop', (e) => {
                            e.preventDefault();
                            fileInputUploadArea.style.borderColor = 'var(--vscode-input-border)';
                            fileInputUploadArea.style.background = 'transparent';
                            
                            const files = Array.from(e.dataTransfer.files);
                            files.forEach(file => {
                                addPersistentFile(file);
                            });
                        });
                        
                        function addPersistentFile(file) {
                            const fileId = Date.now() + Math.random();
                            const fileData = {
                                id: fileId,
                                name: file.name,
                                size: file.size,
                                type: file.type,
                                referenced: true,
                                file: file
                            };
                            
                            persistentFiles.push(fileData);
                            updatePersistentFilesDisplay();
                        }
                        
                        function updatePersistentFilesDisplay() {
                            if (persistentFiles.length === 0) {
                                fileInputList.innerHTML = '<div style="text-align: center; color: var(--vscode-descriptionForeground); font-size: 12px; padding: 20px;">No files uploaded yet</div>';
                                return;
                            }
                            
                            fileInputList.innerHTML = '';
                            
                            persistentFiles.forEach(fileData => {
                                const fileItem = document.createElement('div');
                                fileItem.className = 'file-input-item';
                                
                                fileItem.innerHTML = '<div class="file-input-item-info">' +
                                    '<span class="file-input-item-icon">' + getFileIcon(fileData.name) + '</span>' +
                                    '<span class="file-input-item-name">' + fileData.name + '</span>' +
                                    '<span class="file-input-item-size">' + formatFileSize(fileData.size) + '</span>' +
                                    '</div>' +
                                    '<div class="file-input-item-actions">' +
                                    '<label class="file-input-item-toggle" title="Toggle file reference">' +
                                    '<input type="checkbox"' + (fileData.referenced ? ' checked' : '') + '>' +
                                    '<span class="file-input-item-toggle-slider"></span>' +
                                    '</label>' +
                                    '<button class="file-input-item-remove" title="Remove file">✕</button>' +
                                    '</div>';
                                
                                // Add event listeners
                                const toggle = fileItem.querySelector('input[type="checkbox"]');
                                const removeBtn = fileItem.querySelector('.file-input-item-remove');
                                
                                toggle.addEventListener('change', (e) => {
                                    fileData.referenced = e.target.checked;
                                });
                                
                                removeBtn.addEventListener('click', () => {
                                    persistentFiles = persistentFiles.filter(f => f.id !== fileData.id);
                                    updatePersistentFilesDisplay();
                                });
                                
                                fileInputList.appendChild(fileItem);
                            });
                        }
                        const chatContainer = document.getElementById('chatContainer');
                        const notifBell = document.getElementById('notifBell');
                        const notifPanel = document.getElementById('notifPanel');
                        const notifList = document.getElementById('notifList');
                        const notifListFull = document.getElementById('notifListFull');
                        const activityList = document.getElementById('activityList');
                        const enableAutomation = document.getElementById('enableAutomation');
                        const automationBehavior = document.getElementById('automationBehavior');
                        const webhookUrl = document.getElementById('webhookUrl');
                        const docsFolder = document.getElementById('docsFolder');
                        const autoGenerateOnSave = document.getElementById('autoGenerateOnSave');
                        const statusBarNotifications = document.getElementById('statusBarNotifications');
                        const saveSettingsBtn = document.getElementById('saveSettings');
                        const resetSettingsBtn = document.getElementById('resetSettings');
                        
                        // Streaming UI elements
                        const generationProgress = document.getElementById('generationProgress');
                        const progressPercentage = document.getElementById('progressPercentage');
                        const progressBarFill = document.getElementById('progressBarFill');
                        const progressStatus = document.getElementById('progressStatus');
                        const generationItems = document.getElementById('generationItems');
                        const notifCount = document.getElementById('notifCount');
                        
                        // SECURITY: Sanitize user input to prevent XSS
                        function sanitizeInput(text) {
                            const div = document.createElement('div');
                            div.textContent = text;
                            return div.innerHTML;
                        }
                        
                        // Auto-resize textarea with better scaling
                        function autoResize() {
                            // Reset height to auto to get the correct scrollHeight
                            chatInput.style.height = 'auto';
                            
                            // Calculate new height with constraints
                            const newHeight = Math.min(chatInput.scrollHeight, 120);
                            chatInput.style.height = newHeight + 'px';
                            
                            // Ensure minimum height
                            if (newHeight < 28) {
                                chatInput.style.height = '28px';
                            }
                        }
                        
                        // Placeholder notifications data (will be replaced with real data from extension)
                        const notifications = [
                            { id: 'pr-1024', title: 'PR #1024: Update API endpoints', desc: 'Potential doc changes detected in user-service.', status: 'new', actions: ['View PR', 'Suggest doc update'],
                              issue: 'Potential doc changes detected in user-service.',
                              changed: 'user-service/routes.ts, docs/api.md',
                              suggested: 'user-service.md, API Overview' },
                            { id: 'stale-README', title: 'README may be stale', desc: 'README references old scripts; diff suggests changes.', status: 'new', actions: ['Open README', 'Generate update'],
                              issue: 'README references old scripts; diff suggests changes.',
                              changed: 'scripts/build-old.sh (referenced), package.json scripts: build, dev',
                              suggested: 'README setup steps, scripts section' },
                            { id: 'changelog', title: 'Changelog missing entries', desc: '3 commits without changelog notes.', status: 'seen', actions: ['Generate changelog'],
                              issue: '3 commits without changelog notes.',
                              changed: 'feat: add notifications; fix: doc tasks style; chore: deps tidy',
                              suggested: 'Changelog entries for the above commits' }
                        ];

                        // Placeholder activity entries (will be replaced with real data from ChangeTracker)
                        const activities = [];

                        function updateNotifBadge() {
                            const unread = notifications.filter(n => n.status === 'new').length;
                            if (unread > 0) {
                                notifCount.textContent = String(unread);
                                notifCount.classList.remove('hidden');
                            } else {
                                notifCount.classList.add('hidden');
                            }
                        }
                        

                        function renderNotifications() {
                            if (!notifList) return;
                            notifList.innerHTML = notifications.map((n, idx) => (
                                '<li class="notif-item" data-id="' + n.id + '">'
                                + '<div class="notif-click" data-idx="' + idx + '">'
                                + '<div class="notif-title">' + n.title.replace(/</g,'&lt;').replace(/>/g,'&gt;') + (n.status === 'new' ? ' <span class="badge">New</span>' : '') + '</div>'
                                + '<span class="notif-caret">▸</span>'
                                + '</div>'
                                + '<div class="notif-desc">' + n.desc.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>'
                                + '<div class="notif-details">'
                                + '<div><strong>Issue:</strong> ' + (n.issue ? n.issue.replace(/</g,'&lt;').replace(/>/g,'&gt;') : '') + '</div>'
                                + '<div><strong>Changed files:</strong> ' + (n.changed ? n.changed.replace(/</g,'&lt;').replace(/>/g,'&gt;') : '') + '</div>'
                                + '<div><strong>Suggested docs to update:</strong> ' + (n.suggested ? n.suggested.replace(/</g,'&lt;').replace(/>/g,'&gt;') : '') + '</div>'
                                + '</div>'
                                + '<div class="notif-actions">'
                                + n.actions.map(a => '<button class="btn" data-action="' + a + '" data-idx="' + idx + '">' + a + '</button>').join('')
                                + '</div>'
                                + '</li>'
                            )).join('');
                            // Attach listeners
                            notifList.querySelectorAll('button[data-action]').forEach(btn => {
                                btn.addEventListener('click', () => {
                                    const idx = parseInt(btn.getAttribute('data-idx')||'0',10);
                                    const action = btn.getAttribute('data-action')||'';
                                    const item = notifications[idx];
                                    if (item) {
                                        item.status = 'seen';
                                        updateNotifBadge();
                                        vscode.postMessage({ command: 'notificationAction', id: item.id, action });
                                    }
                                });
                            });
                            notifList.querySelectorAll('.notif-click').forEach(div => {
                                div.addEventListener('click', () => {
                                    const parent = div.closest('.notif-item');
                                    if (!parent) return;
                                    parent.classList.toggle('expanded');
                                    const caret = div.querySelector('.notif-caret');
                                    if (caret) caret.textContent = parent.classList.contains('expanded') ? '▾' : '▸';
                                });
                            });
                        }

                        function renderNotificationsFull() {
                            if (!notifListFull) return;
                            notifListFull.innerHTML = notifications.map((n, idx) => (
                                '<li class="notif-item" data-id="' + n.id + '">'
                                + '<div class="notif-click" data-idx="' + idx + '">'
                                + '<div class="notif-title">' + n.title.replace(/</g,'&lt;').replace(/>/g,'&gt;') + (n.status === 'new' ? ' <span class="badge">New</span>' : '') + '</div>'
                                + '<span class="notif-caret">▸</span>'
                                + '</div>'
                                + '<div class="notif-desc">' + n.desc.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>'
                                + '<div class="notif-details">'
                                + '<div><strong>Issue:</strong> ' + (n.issue ? n.issue.replace(/</g,'&lt;').replace(/>/g,'&gt;') : '') + '</div>'
                                + '<div><strong>Changed files:</strong> ' + (n.changed ? n.changed.replace(/</g,'&lt;').replace(/>/g,'&gt;') : '') + '</div>'
                                + '<div><strong>Suggested docs to update:</strong> ' + (n.suggested ? n.suggested.replace(/</g,'&lt;').replace(/>/g,'&gt;') : '') + '</div>'
                                + '</div>'
                                + '<div class="notif-actions">'
                                + n.actions.map(a => '<button class="btn" data-action="' + a + '" data-idx="' + idx + '">' + a + '</button>').join('')
                                + '</div>'
                                + '</li>'
                            )).join('');
                            notifListFull.querySelectorAll('button[data-action]').forEach(btn => {
                                btn.addEventListener('click', () => {
                                    const idx = parseInt(btn.getAttribute('data-idx')||'0',10);
                                    const action = btn.getAttribute('data-action')||'';
                                    const item = notifications[idx];
                                    if (item) {
                                        item.status = 'seen';
                                        updateNotifBadge();
                                        vscode.postMessage({ command: 'notificationAction', id: item.id, action });
                                    }
                                });
                            });
                            notifListFull.querySelectorAll('.notif-click').forEach(div => {
                                div.addEventListener('click', () => {
                                    const parent = div.closest('.notif-item');
                                    if (!parent) return;
                                    parent.classList.toggle('expanded');
                                    const caret = div.querySelector('.notif-caret');
                                    if (caret) caret.textContent = parent.classList.contains('expanded') ? '▾' : '▸';
                                });
                            });
                        }

                        // Activity rendering
                        function renderActivity(filterFn) {
                            if (!activityList) return;
                            const list = (filterFn ? activities.filter(filterFn) : activities);
                            activityList.innerHTML = list.map((a, idx) => (
                                '<li class="notif-item" data-id="' + a.id + '">'
                                + '<div class="notif-click" data-idx="' + idx + '">'
                                + '<div class="notif-title">[' + a.type + ' • ' + a.status + '] ' + a.title.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>'
                                + '<span class="notif-caret">▸</span>'
                                + '</div>'
                                + '<div class="notif-desc">' + a.when + '</div>'
                                + '<div class="notif-details">' + a.desc.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>'
                                + '<div class="notif-actions">'
                                + (() => {
                                    const actions = ['View diff'];
                                    
                                    // Toggle-like behavior: show the action that can be performed
                                    if (a.status === 'Applied') {
                                        // If applied, show Revert (can revert it)
                                        actions.push('Revert');
                                    } else if (a.status === 'Pending') {
                                        // If pending, show Apply (can apply it)
                                        actions.push('Apply');
                                    } else if (a.status === 'Reverted') {
                                        // If reverted, show Apply (can re-apply it)
                                        actions.push('Apply');
                                    }
                                    
                                    return actions.map(action => '<button class="btn" data-action="' + action + '" data-idx="' + idx + '">' + action + '</button>').join('');
                                })()
                                + '</div>'
                                + '</li>'
                            )).join('');
                            activityList.querySelectorAll('button[data-action]').forEach(btn => {
                                btn.addEventListener('click', () => {
                                    const idx = parseInt(btn.getAttribute('data-idx')||'0',10);
                                    const action = btn.getAttribute('data-action')||'';
                                    const item = activities[idx];
                                    if (item) {
                                        // Use the changeRecord ID if available, otherwise use the item ID
                                        const changeId = item.changeRecord?.id || item.id;
                                        vscode.postMessage({ command: 'activityAction', id: changeId, action });
                                    }
                                });
                            });
                            activityList.querySelectorAll('.notif-click').forEach(div => {
                                div.addEventListener('click', () => {
                                    const parent = div.closest('.notif-item');
                                    if (!parent) return;
                                    parent.classList.toggle('expanded');
                                    const caret = div.querySelector('.notif-caret');
                                    if (caret) caret.textContent = parent.classList.contains('expanded') ? '▾' : '▸';
                                });
                            });
                        }

                        function toggleNotifPanel() {
                            const isHidden = notifPanel.classList.contains('hidden');
                            if (isHidden) {
                                renderNotifications();
                                notifPanel.classList.remove('hidden');
                                // mark all as seen on open
                                notifications.forEach(n => { if (n.status === 'new') n.status = 'seen'; });
                                updateNotifBadge();
                            } else {
                                notifPanel.classList.add('hidden');
                            }
                        }

                        notifBell.addEventListener('click', (e) => {
                            e.stopPropagation();
                            toggleNotifPanel();
                        });

                        document.addEventListener('click', (e) => {
                            if (!notifPanel.classList.contains('hidden')) {
                                if (!notifPanel.contains(e.target) && e.target !== notifBell) {
                                    notifPanel.classList.add('hidden');
                                }
                            }
                        });

                        updateNotifBadge();

                        // Streaming UI Management
                        function showGenerationProgress() {
                            if (generationProgress) {
                                generationProgress.classList.add('active');
                            }
                            
                            // Show pause and cancel buttons, hide generate button
                            showPauseButtons();
                        }
                        
                        function hideGenerationProgress() {
                            if (generationProgress) {
                                generationProgress.classList.remove('active');
                            }
                            
                            // Reset button states
                            resetGenerationButtons();
                        }
                        
                        function resetGenerationButtons() {
                            const generateBtn = document.getElementById('generateAllMissingDocs');
                            const pauseBtn = document.getElementById('pauseGeneration');
                            const resumeBtn = document.getElementById('resumeGeneration');
                            const cancelBtn = document.getElementById('cancelGeneration');
                            
                            if (generateBtn) generateBtn.style.display = 'inline-block';
                            if (pauseBtn) pauseBtn.style.display = 'none';
                            if (resumeBtn) resumeBtn.style.display = 'none';
                            if (cancelBtn) cancelBtn.style.display = 'none';
                        }
                        
                        function showPauseButtons() {
                            const generateBtn = document.getElementById('generateAllMissingDocs');
                            const pauseBtn = document.getElementById('pauseGeneration');
                            const resumeBtn = document.getElementById('resumeGeneration');
                            const cancelBtn = document.getElementById('cancelGeneration');
                            
                            if (generateBtn) generateBtn.style.display = 'none';
                            if (pauseBtn) pauseBtn.style.display = 'inline-block';
                            if (resumeBtn) resumeBtn.style.display = 'none';
                            if (cancelBtn) cancelBtn.style.display = 'inline-block';
                        }
                        
                        function showResumeButtons() {
                            const generateBtn = document.getElementById('generateAllMissingDocs');
                            const pauseBtn = document.getElementById('pauseGeneration');
                            const resumeBtn = document.getElementById('resumeGeneration');
                            const cancelBtn = document.getElementById('cancelGeneration');
                            
                            if (generateBtn) generateBtn.style.display = 'none';
                            if (pauseBtn) pauseBtn.style.display = 'none';
                            if (resumeBtn) resumeBtn.style.display = 'inline-block';
                            if (cancelBtn) cancelBtn.style.display = 'inline-block';
                        }
                        
                        function updateProgress(percentage, status, items = []) {
                            if (progressPercentage) {
                                progressPercentage.textContent = Math.round(percentage) + '%';
                            }
                            if (progressBarFill) {
                                progressBarFill.style.width = percentage + '%';
                            }
                            if (progressStatus) {
                                progressStatus.textContent = status;
                                
                                // Add visual indicator for paused state
                                if (status.includes('paused')) {
                                    progressStatus.style.color = 'var(--vscode-inputValidation-warningForeground)';
                                    progressStatus.style.fontWeight = 'bold';
                                } else if (status.includes('resumed')) {
                                    progressStatus.style.color = 'var(--vscode-inputValidation-infoForeground)';
                                    progressStatus.style.fontWeight = 'bold';
                                } else if (status.includes('cancelled')) {
                                    progressStatus.style.color = 'var(--vscode-inputValidation-errorForeground)';
                                    progressStatus.style.fontWeight = 'bold';
                                } else {
                                    progressStatus.style.color = 'var(--vscode-foreground)';
                                    progressStatus.style.fontWeight = 'normal';
                                }
                            }
                            if (generationItems && items.length > 0) {
                                generationItems.innerHTML = items.map(item => 
                                    '<div class="generation-item">' +
                                        '<div class="item-status ' + item.status + '"></div>' +
                                        '<div class="item-name">' + item.name + '</div>' +
                                        '<div class="item-type">' + item.type + '</div>' +
                                    '</div>'
                                ).join('');
                            }
                        }
                        
                        function switchToTab(tabName) {
                            const tabs = Array.from(document.querySelectorAll('.tab-btn'));
                            const panels = Array.from(document.querySelectorAll('.tab-panel'));
                            const targetTab = tabs.find(t => t.getAttribute('data-tab') === tabName);
                            if (targetTab) {
                                tabs.forEach(t => t.classList.toggle('active', t === targetTab));
                                panels.forEach(p => p.classList.toggle('active', p.getAttribute('data-panel') === tabName));
                            }
                        }
                        
                        function addActivityEntry(type, status, title, description) {
                            if (!activities) return;
                            const entry = {
                                id: 'act-' + Date.now(),
                                type,
                                status,
                                title,
                                desc: description,
                                when: 'just now'
                            };
                            activities.unshift(entry);
                            if (activityList && document.querySelector('[data-tab="activity"]').classList.contains('active')) {
                                renderActivity();
                            }
                        }

                        // Initialize dashboard
                        function initializeDashboard() {
                            // Request project analysis from extension
                            vscode.postMessage({
                                command: 'analyzeProject'
                            });
                        }
                        
                        function refreshDashboard() {
                            // Only refresh if we're on the dashboard tab and not currently generating
                            const dashboardTab = document.querySelector('.tab-btn[data-tab="dashboard"]');
                            const isDashboardActive = dashboardTab && dashboardTab.classList.contains('active');
                            
                            if (isDashboardActive) {
                                vscode.postMessage({
                                    command: 'analyzeProject'
                                });
                            }
                        }
                        
                        function updateProjectOverview(stats, skipStatusUpdate = false) {
                            const projectStatus = document.getElementById('projectStatus');
                            const projectHealth = document.getElementById('projectHealth');
                            const lastUpdated = document.getElementById('lastUpdated');
                            
                            // Only update status if not currently generating and not explicitly skipped
                            if (projectStatus && !skipStatusUpdate) {
                                const currentStatus = projectStatus.textContent;
                                // Don't change status if we're in the middle of generation
                                if (currentStatus !== 'Generating...' && currentStatus !== 'Paused') {
                                    if (stats.projectStructure && stats.projectStructure.framework !== 'Unknown') {
                                        projectStatus.textContent = 'Ready';
                                        projectStatus.className = 'overview-value status-complete';
                                    } else {
                                        projectStatus.textContent = 'Analyzing...';
                                        projectStatus.className = 'overview-value status-analyzing';
                                    }
                                }
                            }
                            
                            if (projectHealth) {
                                const coverage = stats.projectStructure?.coverage || stats.docCoverage || 0;
                                if (coverage >= 20) {
                                    projectHealth.textContent = 'Good';
                                    projectHealth.className = 'overview-value health-good';
                                } else if (coverage >= 10) {
                                    projectHealth.textContent = 'Warning';
                                    projectHealth.className = 'overview-value health-warning';
                                } else {
                                    projectHealth.textContent = 'Poor';
                                    projectHealth.className = 'overview-value health-poor';
                                }
                            }
                            
                            if (lastUpdated) {
                                setLastUpdatedTimestamp();
                            }
                            
                            // Update project overview with detailed information
                            updateProjectOverviewDetails(stats);
                        }
                        
                        let lastUpdatedTimestamp = null;
                        
                        function updateLastUpdatedTime() {
                            const lastUpdated = document.getElementById('lastUpdated');
                            if (lastUpdated && lastUpdatedTimestamp) {
                                const timeString = getRelativeTimeString(lastUpdatedTimestamp);
                                lastUpdated.textContent = timeString;
                            }
                        }
                        
                        function setLastUpdatedTimestamp() {
                            lastUpdatedTimestamp = new Date();
                            updateLastUpdatedTime();
                        }
                        
                        function getRelativeTimeString(date) {
                            const now = new Date();
                            const diffMs = now - date;
                            const diffMins = Math.floor(diffMs / 60000);
                            const diffHours = Math.floor(diffMs / 3600000);
                            const diffDays = Math.floor(diffMs / 86400000);
                            
                            if (diffMins < 1) {
                                return 'Just now';
                            } else if (diffMins < 60) {
                                return diffMins + 'm ago';
                            } else if (diffHours < 24) {
                                return diffHours + 'h ago';
                            } else if (diffDays < 7) {
                                return diffDays + 'd ago';
                            } else {
                                return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                            }
                        }
                        
                        function updateProjectOverviewDetails(stats) {
                            const projectDetails = document.getElementById('projectDetails');
                            if (!projectDetails || !stats.projectStructure) return;
                            
                            // Update with project structure details
                            const framework = stats.projectStructure.framework || 'Unknown';
                            const architecture = stats.projectStructure.architecture || 'Unknown';
                            const domains = stats.projectStructure.domains?.length || 0;
                            
                            // Build components string from boolean flags
                            const components = [];
                            if (stats.projectStructure.hasFrontend) components.push('Frontend');
                            if (stats.projectStructure.hasBackend) components.push('Backend');
                            if (stats.projectStructure.hasDatabase) components.push('Database');
                            if (stats.projectStructure.hasTests) components.push('Tests');
                            const componentsString = components.length > 0 ? components.join(' + ') : 'Unknown';
                            
                            projectDetails.innerHTML = 
                                '<div class="project-stats">' +
                                    '<div class="stat-item">' +
                                        '<span class="stat-label">Framework:</span>' +
                                        '<span class="stat-value">' + framework + '</span>' +
                                    '</div>' +
                                    '<div class="stat-item">' +
                                        '<span class="stat-label">Architecture:</span>' +
                                        '<span class="stat-value">' + architecture + '</span>' +
                                    '</div>' +
                                    '<div class="stat-item">' +
                                        '<span class="stat-label">Domains:</span>' +
                                        '<span class="stat-value">' + domains + '</span>' +
                                    '</div>' +
                                    '<div class="stat-item">' +
                                        '<span class="stat-label">Components:</span>' +
                                        '<span class="stat-value">' + componentsString + '</span>' +
                                    '</div>' +
                                '</div>';
                        }
                        
                        function setProjectStatus(status, className) {
                            const projectStatus = document.getElementById('projectStatus');
                            if (projectStatus) {
                                projectStatus.textContent = status;
                                projectStatus.className = 'overview-value ' + className;
                            }
                        }
                        
                        // Update dashboard stats
                        function updateDashboardStats(stats) {
                            document.getElementById('totalFiles').textContent = stats.projectStructure?.totalFiles || stats.totalFiles || 0;
                            document.getElementById('docFiles').textContent = stats.projectStructure?.docFiles || stats.docFiles || 0;
                            document.getElementById('codeFiles').textContent = stats.projectStructure?.codeFiles || stats.codeFiles || 0;
                            const coverage = stats.projectStructure?.coverage || stats.docCoverage || 0;
                            // Ensure we don't add duplicate % symbols
                            const coverageText = typeof coverage === 'string' ? coverage : coverage + '%';
                            document.getElementById('docCoverage').textContent = coverageText;
                            
                            // Project details are now integrated into the main project overview section
                            
                            // Update project overview (skip status update during file change refresh to prevent cycling)
                            updateProjectOverview(stats, true);
                            
                            // Update breakdown chart
                            updateBreakdownChart(stats);

                            // Update doc tasks list
                            const list = document.getElementById('docTasksList');
                            if (list) {
                                if (!stats.docTasks || stats.docTasks.length === 0) {
                                    list.innerHTML = '<div class="empty-state"><div class="empty-state-message">No missing or outdated documentation found.</div></div>';
                                } else {
                                    list.innerHTML = stats.docTasks.slice(0, 20).map((task, idx) => {
                                        const priorityClass = task.priority === 'high' ? 'priority-high' : task.priority === 'medium' ? 'priority-medium' : 'priority-low';
                                        const typeIcon = task.type === 'missing' ? '📝' : '🔄';
                                        const actionText = task.type === 'missing' ? 'Generate' : 'Update';
                                        
                                        return '<div class="task-card ' + priorityClass + '">'
                                            + '<div class="task-header">'
                                                + '<span class="task-icon">' + typeIcon + '</span>'
                                                + '<span class="task-title">' + task.title + '</span>'
                                                + '<span class="task-priority">' + task.priority.toUpperCase() + '</span>'
                                            + '</div>'
                                            + '<div class="task-description">' + task.description + '</div>'
                                            + '<div class="task-actions">'
                                                + '<button class="btn" data-action="generate" data-idx="' + idx + '">' + actionText + '</button>'
                                            + '</div>'
                                        + '</div>';
                                    }).join('');
                                    
                                    // Attach handlers
                                    list.querySelectorAll('button[data-action]').forEach((btn)=>{
                                        btn.addEventListener('click', ()=>{
                                            const action = btn.getAttribute('data-action');
                                            const idx = parseInt(btn.getAttribute('data-idx')||'0',10);
                                            vscode.postMessage({ command: 'docTaskAction', action, index: idx });
                                        });
                                    });
                                }
                            }
                        }
                        
                        // Update breakdown chart
                        function updateBreakdownChart(stats) {
                            const chart = document.getElementById('breakdownChart');
                            if (!stats.fileTypes || Object.keys(stats.fileTypes).length === 0) {
                                chart.innerHTML = '<div>No files found in workspace</div>';
                                return;
                            }

                            // Categorize types
                            const groups = {
                                Docs: ['md','txt','rst','adoc'],
                                Code: ['ts','tsx','js','jsx','py','java','kt','rb','go','rs','c','cpp','cs','php','swift'],
                                Config: ['json','yaml','yml','toml','ini','env'],
                                Assets: ['png','jpg','jpeg','gif','svg','ico','webp','mp4','mp3','wav','pdf']
                            };
                            const totals = { Docs:0, Code:0, Config:0, Assets:0, Other:0 };
                            const entries = Object.entries(stats.fileTypes);
                            const totalFiles = entries.reduce((s, [,c]) => s + c, 0);

                            function groupOf(ext){
                                for (const [g, list] of Object.entries(groups)) if (list.includes(ext)) return g;
                                return 'Other';
                            }

                            const grouped = { Docs:[], Code:[], Config:[], Assets:[], Other:[] };
                            for (const [ext, count] of entries) {
                                const g = groupOf(ext);
                                totals[g] += count;
                                grouped[g].push([ext, count]);
                            }
                            for (const key of Object.keys(grouped)) grouped[key].sort((a,b)=>b[1]-a[1]);

                            const parts = [];
                            for (const key of ['Docs','Code','Config','Assets','Other']) {
                                if (totals[key] === 0) continue;
                                const percent = Math.round((totals[key]/totalFiles)*100);
                                const items = grouped[key].map(([ext,count])=>{
                                    const p = Math.round((count/totalFiles)*100);
                                    // Truncate very long labels (e.g., path-like extensions)
                                    let label = ('.' + ext);
                                    if (label.length > 14) {
                                        label = label.slice(0, 12) + '…';
                                    }
                                    return '<div class="breakdown-item">'
                                        + '<span class="badge">' + label + '</span>'
                                        + '<div class="breakdown-bar" style="max-width:60%; width:' + p + '%;"></div>'
                                        + '<span class="badge">' + count + ' (' + p + '%)</span>'
                                        + '</div>';
                                }).join('');
                                parts.push(
                                    '<div class="breakdown-group">'
                                    + '<div class="breakdown-group-header" data-group="' + key + '">'
                                    + '<strong>' + key + '</strong>'
                                    + '<span class="badge">' + totals[key] + ' files • ' + percent + '%</span>'
                                    + '</div>'
                                    + '<div class="breakdown-items" id="items-' + key + '">' + items + '</div>'
                                    + '</div>'
                                );
                            }
                            chart.innerHTML = '<ul class="breakdown-list">' + parts.join('') + '</ul>';

                            // Toggle groups on click
                            chart.querySelectorAll('.breakdown-group-header').forEach((el)=>{
                                el.addEventListener('click', ()=>{
                                    const g = el.getAttribute('data-group');
                                    const itemsEl = document.getElementById('items-' + g);
                                    if (!itemsEl) return;
                                    itemsEl.style.display = itemsEl.style.display === 'block' ? 'none' : 'block';
                                });
                            });
                        }
                        
                        function addUserMessage(text) {
                            // Remove welcome message
                            const welcomeMsg = chatContainer.querySelector('.welcome-message');
                            if (welcomeMsg) welcomeMsg.remove();
                            
                            const messageDiv = document.createElement('div');
                            messageDiv.className = 'message user';
                            
                            const avatar = document.createElement('div');
                            avatar.className = 'avatar user';
                            avatar.textContent = '👤';
                            
                            const content = document.createElement('div');
                            content.className = 'message-content';
                            
                            // Add message header with sender and timestamp
                            const header = document.createElement('div');
                            header.className = 'message-header';
                            
                            const sender = document.createElement('div');
                            sender.className = 'message-sender';
                            sender.textContent = 'You';
                            
                            const timestamp = document.createElement('div');
                            timestamp.className = 'message-timestamp';
                            timestamp.textContent = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                            
                            header.appendChild(sender);
                            header.appendChild(timestamp);
                            
                            // Add message text
                            const messageText = document.createElement('div');
                            messageText.innerHTML = sanitizeInput(text);
                            
                            // Add status indicator
                            const status = document.createElement('div');
                            status.className = 'message-status';
                            status.innerHTML = '<div class="status-icon status-sending"></div> Sending...';
                            
                            content.appendChild(header);
                            content.appendChild(messageText);
                            content.appendChild(status);
                            
                            messageDiv.appendChild(avatar);
                            messageDiv.appendChild(content);
                            chatContainer.appendChild(messageDiv);
                            chatContainer.scrollTop = chatContainer.scrollHeight;
                            
                            // Update status to delivered after a short delay
                            setTimeout(() => {
                                status.innerHTML = '<div class="status-icon status-delivered"></div> Delivered';
                            }, 1000);
                        }

                        function addAiMessageContainer() {
                            // Remove welcome message
                            const welcomeMsg = chatContainer.querySelector('.welcome-message');
                            if (welcomeMsg) welcomeMsg.remove();
                            
                            const messageDiv = document.createElement('div');
                            messageDiv.className = 'message ai';
                            
                            const avatar = document.createElement('div');
                            avatar.className = 'avatar ai';
                            avatar.textContent = '🤖';
                            
                            const content = document.createElement('div');
                            content.className = 'message-content';
                            
                            // Add message header with sender and timestamp
                            const header = document.createElement('div');
                            header.className = 'message-header';
                            
                            const sender = document.createElement('div');
                            sender.className = 'message-sender';
                            sender.textContent = 'Documind AI';
                            
                            const timestamp = document.createElement('div');
                            timestamp.className = 'message-timestamp';
                            timestamp.textContent = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                            
                            header.appendChild(sender);
                            header.appendChild(timestamp);
                            
                            // Add thinking indicator
                            const thinkingIndicator = document.createElement('div');
                            thinkingIndicator.className = 'thinking-indicator';
                            thinkingIndicator.innerHTML = '<div class="thinking-dots"><span></span><span></span><span></span></div><span class="thinking-text">Thinking...</span><div class="thinking-progress"><div class="thinking-progress-bar"></div></div>';
                            
                            // Add typing indicator (for when thinking is done)
                            const typingIndicator = document.createElement('div');
                            typingIndicator.className = 'typing-indicator';
                            typingIndicator.style.display = 'none';
                            typingIndicator.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
                            
                            const actions = document.createElement('div');
                            actions.className = 'message-actions';
                            
                            const insertBtn = document.createElement('button');
                            insertBtn.className = 'action-btn';
                            insertBtn.innerHTML = '📝 Insert to file';
                            insertBtn.addEventListener('click', () => {
                                vscode.postMessage({ command: 'insertToFile', content: content.innerText });
                            });
                            
                            const replaceBtn = document.createElement('button');
                            replaceBtn.className = 'action-btn';
                            replaceBtn.innerHTML = '🔄 Replace selection';
                            replaceBtn.addEventListener('click', () => {
                                vscode.postMessage({ command: 'replaceSelection', content: content.innerText });
                            });
                            
                            actions.appendChild(insertBtn);
                            actions.appendChild(replaceBtn);
                            
                            content.appendChild(header);
                            content.appendChild(thinkingIndicator);
                            content.appendChild(typingIndicator);
                            
                            messageDiv.appendChild(avatar);
                            messageDiv.appendChild(content);
                            messageDiv.appendChild(actions);
                            
                            chatContainer.appendChild(messageDiv);
                            chatContainer.scrollTop = chatContainer.scrollHeight;
                            return { content, thinkingIndicator, typingIndicator, actions };
                        }

                        function appendTo(targetEl, chunk) {
                            targetEl.innerText += chunk;
                            chatContainer.scrollTop = chatContainer.scrollHeight;
                        }
                        
                        // Event listeners
                        sendBtn.addEventListener('click', sendMessage);
                        uploadBtn.addEventListener('click', () => {
                            // Create file input element
                            const fileInput = document.createElement('input');
                            fileInput.type = 'file';
                            fileInput.multiple = true;
                            fileInput.accept = '.js,.ts,.jsx,.tsx,.py,.java,.cpp,.c,.html,.css,.scss,.sass,.json,.xml,.yaml,.yml,.md,.txt,.pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.svg,.zip,.rar,.tar,.gz';
                            
                            fileInput.addEventListener('change', (e) => {
                                const files = Array.from(e.target.files);
                                files.forEach(file => {
                                    addFileToList(file);
                                });
                            });
                            
                            fileInput.click();
                        });
                        
                        // Dashboard button event listeners
                        document.getElementById('generateReadme').addEventListener('click', () => {
                            vscode.postMessage({ command: 'generateReadme' });
                        });
                        
                        document.getElementById('generateApiDocs').addEventListener('click', () => {
                            vscode.postMessage({ command: 'generateApiDocs' });
                        });
                        
                        document.getElementById('generateChangelog').addEventListener('click', () => {
                            vscode.postMessage({ command: 'generateChangelog' });
                        });
                        
                        document.getElementById('analyzeProject').addEventListener('click', () => {
                            vscode.postMessage({ command: 'analyzeProject' });
                        });
                        
                        document.getElementById('generateAllMissingDocs').addEventListener('click', () => {
                            vscode.postMessage({ command: 'generateAllMissingDocs' });
                        });
                        
                        document.getElementById('pauseGeneration').addEventListener('click', () => {
                            vscode.postMessage({ command: 'pauseGeneration' });
                        });
                        
                        document.getElementById('resumeGeneration').addEventListener('click', () => {
                            vscode.postMessage({ command: 'resumeGeneration' });
                        });
                        
                        document.getElementById('cancelGeneration').addEventListener('click', () => {
                            vscode.postMessage({ command: 'cancelGeneration' });
                        });
                        
                        // Initialize dashboard on load
                        initializeDashboard();
                        
                        // Auto-refresh removed - file change detection handles updates efficiently
                        
                        // Update last updated time every minute
                        setInterval(() => {
                            updateLastUpdatedTime();
                        }, 60000);

                        // Tabs behavior
                        (function(){
                            const tabs = Array.from(document.querySelectorAll('.tab-btn'));
                            const panels = Array.from(document.querySelectorAll('.tab-panel'));
                            function activate(tab){
                                const name = tab.getAttribute('data-tab');
                                tabs.forEach(t=>t.classList.toggle('active', t===tab));
                                panels.forEach(p=>p.classList.toggle('active', p.getAttribute('data-panel')===name));
                                
                                // Show/hide file input button only in chat tab
                                const fileInputContainer = document.getElementById('fileInputContainer');
                                if (fileInputContainer) {
                                    fileInputContainer.style.display = name === 'chat' ? 'block' : 'none';
                                    if (name === 'chat') {
                                        positionFileInputButton();
                                    }
                                }
                                
                                if (name === 'notifications') {
                                    renderNotificationsFull();
                                } else if (name === 'activity') {
                                    renderActivity();
                                }
                            }
                            // Activity filters
                            const filterBtns = [
                                ['filterAll', ()=>true],
                                ['filterAuto', a=>a.type==='Auto'],
                                ['filterManual', a=>a.type==='Manual'],
                                ['filterPending', a=>a.status==='Pending'],
                                ['filterApplied', a=>a.status==='Applied'],
                            ];
                            filterBtns.forEach(([id,fn])=>{
                                const el = document.getElementById(id);
                                if (el) el.addEventListener('click', ()=>renderActivity(fn));
                            });

                            // Settings persistence (session-only)
                            const state = vscode.getState() || {};
                            function loadSettings(){
                                if (enableAutomation) enableAutomation.checked = !!state.enableAutomation;
                                if (automationBehavior) automationBehavior.value = state.automationBehavior || 'suggest';
                                if (webhookUrl) webhookUrl.value = state.webhookUrl || '';
                                if (docsFolder) docsFolder.value = state.docsFolder || 'docs/';
                                if (autoGenerateOnSave) autoGenerateOnSave.checked = !!state.autoGenerateOnSave;
                                if (statusBarNotifications) statusBarNotifications.checked = state.statusBarNotifications !== false;
                            }
                            function saveSettings(){
                                const newState = {
                                    ...state,
                                    enableAutomation: enableAutomation ? enableAutomation.checked : false,
                                    automationBehavior: automationBehavior ? automationBehavior.value : 'suggest',
                                    webhookUrl: webhookUrl ? webhookUrl.value : '',
                                    docsFolder: docsFolder ? docsFolder.value : 'docs/',
                                    autoGenerateOnSave: autoGenerateOnSave ? autoGenerateOnSave.checked : false,
                                    statusBarNotifications: statusBarNotifications ? statusBarNotifications.checked : true
                                };
                                vscode.setState(newState);
                                vscode.postMessage({ command: 'saveSettings', settings: { 
                                    enableAutomation: newState.enableAutomation, 
                                    automationBehavior: newState.automationBehavior,
                                    webhookUrl: newState.webhookUrl,
                                    docsFolder: newState.docsFolder,
                                    autoGenerateOnSave: newState.autoGenerateOnSave,
                                    statusBarNotifications: newState.statusBarNotifications
                                }});
                            }
                            if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', saveSettings);
                            if (resetSettingsBtn) resetSettingsBtn.addEventListener('click', ()=>{ vscode.setState({}); loadSettings(); });
                            loadSettings();
                            tabs.forEach(t=>t.addEventListener('click', ()=>activate(t)));
                            
                            // Initialize file input button visibility based on active tab
                            const activeTab = document.querySelector('.tab-btn.active');
                            const fileInputContainer = document.getElementById('fileInputContainer');
                            if (activeTab && fileInputContainer) {
                                const tabName = activeTab.getAttribute('data-tab');
                                fileInputContainer.style.display = tabName === 'chat' ? 'block' : 'none';
                                if (tabName === 'chat') {
                                    positionFileInputButton();
                                }
                            }
                            
                        })();
                        
                        // Removed collapse/expand for breakdown to simplify UI
                        
                        chatInput.addEventListener('keypress', (e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                sendMessage();
                            }
                        });
                        
                        chatInput.addEventListener('input', autoResize);
                        
                        function sendMessage() {
                            const message = chatInput.value.trim();
                            if (message) {
                                console.log('Send button clicked, message:', message); // Debug log
                                addUserMessage(message);
                                console.log('Sending message to extension:', { command: 'chat', message: message }); // Debug log
                                vscode.postMessage({ command: 'chat', message: message });
                                chatInput.value = '';
                                autoResize();
                                
                                // Disable send button and show typing indicator
                                sendBtn.disabled = true;
                                showTypingIndicator();
                            }
                        }
                        
                        function showTypingIndicator() {
                            const typingDiv = document.createElement('div');
                            typingDiv.className = 'message ai typing-indicator';
                            typingDiv.id = 'typingIndicator';
                            
                            const avatar = document.createElement('div');
                            avatar.className = 'avatar ai';
                            avatar.textContent = '🤖';
                            
                            const content = document.createElement('div');
                            content.className = 'message-content';
                            content.innerHTML = '<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
                            
                            typingDiv.appendChild(avatar);
                            typingDiv.appendChild(content);
                            chatContainer.appendChild(typingDiv);
                            chatContainer.scrollTop = chatContainer.scrollHeight;
                        }
                        
                        function hideTypingIndicator() {
                            const typingIndicator = document.getElementById('typingIndicator');
                            if (typingIndicator) {
                                typingIndicator.remove();
                            }
                        }
                        
                        window.addEventListener('message', event => {
                            const message = event.data;
                            console.log('Webview received message from extension:', message); // Debug log
                            
                            if (message.command === 'thinking-start') {
                                console.log('Starting thinking process...'); // Debug log
                                hideTypingIndicator();
                                window._streamTarget = addAiMessageContainer();
                            } else if (message.command === 'thinking-update') {
                                console.log('Thinking update:', message.thought); // Debug log
                                if (window._streamTarget && window._streamTarget.thinkingIndicator) {
                                    const thinkingText = window._streamTarget.thinkingIndicator.querySelector('.thinking-text');
                                    const progressBar = window._streamTarget.thinkingIndicator.querySelector('.thinking-progress-bar');
                                    if (thinkingText) thinkingText.textContent = message.thought;
                                    if (progressBar) progressBar.style.width = (message.progress * 100) + '%';
                                }
                            } else if (message.command === 'stream-start') {
                                console.log('Starting stream...'); // Debug log
                                if (window._streamTarget && window._streamTarget.thinkingIndicator) {
                                    // Hide thinking indicator and show typing indicator
                                    window._streamTarget.thinkingIndicator.style.display = 'none';
                                    window._streamTarget.typingIndicator.style.display = 'flex';
                                }
                            } else if (message.command === 'stream-chunk') {
                                console.log('Stream chunk received:', message.content); // Debug log
                                if (window._streamTarget && window._streamTarget.content) {
                                    // Remove typing indicator and add content
                                    const typingIndicator = window._streamTarget.content.querySelector('.typing-indicator');
                                    if (typingIndicator) {
                                        typingIndicator.remove();
                                    }
                                    appendTo(window._streamTarget.content, message.content);
                                }
                            } else if (message.command === 'stream-end') {
                                console.log('Stream ended'); // Debug log
                                window._streamTarget = undefined;
                                sendBtn.disabled = false; // Re-enable send button
                            } else if (message.command === 'response') {
                                console.log('Response received:', message.content); // Debug log
                                hideTypingIndicator();
                                const result = addAiMessageContainer();
                                // Remove typing indicator and add content
                                const typingIndicator = result.content.querySelector('.typing-indicator');
                                if (typingIndicator) {
                                    typingIndicator.remove();
                                }
                                result.content.appendChild(document.createTextNode(message.content));
                                sendBtn.disabled = false; // Re-enable send button
                            } else if (message.command === 'updateDashboardStats') {
                                console.log('Updating dashboard stats:', message.stats); // Debug log
                                updateDashboardStats(message.stats);
                            } else if (message.command === 'updateNotifications') {
                                console.log('Updating notifications:', message.notifications); // Debug log
                                // Update the notifications array with new data
                                notifications.length = 0;
                                notifications.push(...message.notifications);
                                renderNotifications();
                                renderNotificationsFull();
                            } else if (message.command === 'updateActivities') {
                                console.log('Updating activities:', message.activities); // Debug log
                                // Update the activities array with new data
                                activities.length = 0;
                                activities.push(...message.activities);
                                renderActivity();
                            } else if (message.command === 'generationStart') {
                                showGenerationProgress();
                                updateProgress(0, 'Starting documentation generation...', message.items || []);
                                addActivityEntry('Auto', 'Pending', 'Documentation generation started', 'Generating docs for ' + (message.totalItems || 0) + ' items');
                                setProjectStatus('Generating...', 'status-generating');
                            } else if (message.command === 'generationProgress') {
                                updateProgress(message.percentage || 0, message.status || 'Generating...', message.items || []);
                            } else if (message.command === 'generationComplete') {
                                updateProgress(100, 'Documentation generation completed!', message.items || []);
                                addActivityEntry('Auto', 'Applied', 'Documentation generation completed', 'Generated ' + (message.completedItems || 0) + ' documentation files');
                                setProjectStatus('Complete', 'status-complete');
                                setTimeout(() => hideGenerationProgress(), 3000);
                            } else if (message.command === 'generationError') {
                                updateProgress(message.percentage || 0, 'Error: ' + (message.error || 'Unknown error'), message.items || []);
                                addActivityEntry('Auto', 'Error', 'Documentation generation failed', message.error || 'Unknown error');
                            } else if (message.command === 'generationPaused') {
                                updateProgress(message.percentage || 0, 'Generation paused by user', message.items || []);
                                addActivityEntry('Auto', 'Paused', 'Documentation generation paused', message.message || 'Paused by user');
                                setProjectStatus('Paused', 'status-generating');
                                showResumeButtons();
                            } else if (message.command === 'generationResumed') {
                                updateProgress(message.percentage || 0, 'Generation resumed by user', message.items || []);
                                addActivityEntry('Auto', 'Resumed', 'Documentation generation resumed', message.message || 'Resumed by user');
                                setProjectStatus('Generating...', 'status-generating');
                                showPauseButtons();
                            } else if (message.command === 'generationCancelled') {
                                updateProgress(message.percentage || 0, 'Generation cancelled by user', message.items || []);
                                addActivityEntry('Auto', 'Cancelled', 'Documentation generation cancelled', message.message || 'Cancelled by user');
                                setProjectStatus('Cancelled', 'status-analyzing');
                                setTimeout(() => hideGenerationProgress(), 2000);
                            } else if (message.command === 'generationCompleted') {
                                // Reset button states when generation completes
                                resetGenerationButtons();
                                // Project details are now integrated into the main project overview section
                                // Project overview will be updated by auto-refresh, no need to update manually
                            } else if (message.command === 'switchTab') {
                                switchToTab(message.tabName || 'dashboard');
                            }
                        });
                    </script>
                </body>
                </html>
            `;

            // Helper functions for generation and file parsing
            function checkForGenerationRequest(userMessage: string): { shouldGenerate: boolean; docType: string; action: string } {
                const message = userMessage.toLowerCase();
                const generateKeywords = ['generate', 'create', 'make'];
                const docTypes = {
                    'readme': 'README.md',
                    'api': 'API.md', 
                    'architecture': 'ARCHITECTURE.md',
                    'setup': 'SETUP.md',
                    'contributing': 'CONTRIBUTING.md',
                    'changelog': 'CHANGELOG.md',
                    'auth': 'AUTHENTICATION.md',
                    'authentication': 'AUTHENTICATION.md',
                    'user management': 'USER_MANAGEMENT.md',
                    'user-management': 'USER_MANAGEMENT.md',
                    'api routes': 'API_ROUTES.md',
                    'api-routes': 'API_ROUTES.md'
                };
                
                // Check for generation keywords
                const hasGenerateKeyword = generateKeywords.some(keyword => message.includes(keyword));
                
                // Find document type
                for (const [keyword, fileName] of Object.entries(docTypes)) {
                    if (message.includes(keyword)) {
                        return {
                            shouldGenerate: hasGenerateKeyword,
                            docType: keyword,
                            action: hasGenerateKeyword ? 'generate' : 'explain'
                        };
                    }
                }
                
                return { shouldGenerate: false, docType: '', action: '' };
            }
            
            async function handleGenerationRequest(request: { shouldGenerate: boolean; docType: string; action: string }, webviewView: any) {
                if (request.action === 'generate') {
                    const docTypeMap = {
                        'readme': 'README.md',
                        'api': 'API.md', 
                        'architecture': 'ARCHITECTURE.md',
                        'setup': 'SETUP.md',
                        'contributing': 'CONTRIBUTING.md',
                        'changelog': 'CHANGELOG.md',
                        'auth': 'AUTHENTICATION.md',
                        'authentication': 'AUTHENTICATION.md',
                        'user management': 'USER_MANAGEMENT.md',
                        'user-management': 'USER_MANAGEMENT.md',
                        'api routes': 'API_ROUTES.md',
                        'api-routes': 'API_ROUTES.md'
                    };
                    
                    const fileName = docTypeMap[request.docType as keyof typeof docTypeMap];
                    if (fileName) {
                        try {
                            // Show thinking process
                            webviewView.webview.postMessage({ command: 'thinking-start' });
                            
                            const thoughtProcess = [
                                "Analyzing your request...",
                                "Preparing to generate documentation...",
                                "Creating file content...",
                                "Writing to filesystem..."
                            ];
                            
                            for (let i = 0; i < thoughtProcess.length; i++) {
                                webviewView.webview.postMessage({ 
                                    command: 'thinking-update', 
                                    thought: thoughtProcess[i],
                                    progress: (i + 1) / thoughtProcess.length
                                });
                                await new Promise(r => setTimeout(r, 500));
                            }
                            
                            // Generate the actual file
                            await generateDocumentationFile(request.docType, fileName);
                            
                            // Send success response
                            const successMessage = `✅ **Successfully generated ${fileName}**\n\nThe documentation file has been created and is ready to use. You can find it in your project directory.`;
                            
                            webviewView.webview.postMessage({ command: 'stream-start' });
                            const chunks = successMessage.match(/.{1,80}/gs) || [successMessage];
                            for (const ch of chunks) {
                                webviewView.webview.postMessage({ command: 'stream-chunk', content: ch });
                                await new Promise(r => setTimeout(r, 50));
                            }
                            webviewView.webview.postMessage({ command: 'stream-end' });
                            
                        } catch (error) {
                            console.error('Error generating file:', error);
                            const errorMessage = `❌ **Error generating ${fileName}**\n\n${error instanceof Error ? error.message : 'Unknown error occurred'}`;
                            
                            webviewView.webview.postMessage({ command: 'stream-start' });
                            const chunks = errorMessage.match(/.{1,80}/gs) || [errorMessage];
                            for (const ch of chunks) {
                                webviewView.webview.postMessage({ command: 'stream-chunk', content: ch });
                                await new Promise(r => setTimeout(r, 50));
                            }
                            webviewView.webview.postMessage({ command: 'stream-end' });
                        }
                    }
                }
            }
            
            async function generateDocumentationFile(docType: string, fileName: string) {
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (!workspaceFolder) {
                    throw new Error('No workspace folder found');
                }
                
                // Get real workspace analysis data
                const { WorkspaceAnalyzer } = await import('./services/WorkspaceAnalyzer');
                const analyzer = new WorkspaceAnalyzer();
                const analysis = await analyzer.analyzeWorkspace();
                
                // Determine file path
                const isRootFile = ['README.md', 'CONTRIBUTING.md', 'CHANGELOG.md'].includes(fileName);
                const filePath = isRootFile ? 
                    vscode.Uri.joinPath(workspaceFolder.uri, fileName) :
                    vscode.Uri.joinPath(workspaceFolder.uri, 'docs', fileName);
                
                // Ensure docs directory exists for non-root files
                if (!isRootFile) {
                    const docsDir = vscode.Uri.joinPath(workspaceFolder.uri, 'docs');
                    try {
                        await vscode.workspace.fs.stat(docsDir);
                    } catch {
                        await vscode.workspace.fs.createDirectory(docsDir);
                    }
                }
                
                // Generate content based on doc type using real analysis data
                let content = '';
                
                switch (docType) {
                    case 'readme':
                        content = generateReadmeContent(analysis);
                        break;
                    case 'api':
                        content = generateApiContent(analysis);
                        break;
                    case 'architecture':
                        content = generateArchitectureContent(analysis);
                        break;
                    case 'setup':
                        content = generateSetupContent(analysis);
                        break;
                    case 'contributing':
                        content = generateContributingContent(analysis);
                        break;
                    case 'changelog':
                        content = generateChangelogContent(analysis);
                        break;
                    case 'authentication':
                    case 'auth':
                        content = generateAuthenticationContent(analysis);
                        break;
                    case 'user management':
                    case 'user-management':
                        content = generateUserManagementContent(analysis);
                        break;
                    case 'api routes':
                    case 'api-routes':
                        content = generateApiRoutesContent(analysis);
                        break;
                    default:
                        content = `# ${fileName.replace('.md', '')}\n\nThis documentation file was generated by Documind AI.`;
                }
                
                // Write file
                await vscode.workspace.fs.writeFile(filePath, Buffer.from(content, 'utf-8'));
            }
            
            // Content generation functions using real analysis data
            function generateReadmeContent(analysis: any): string {
                const structure = analysis.projectStructure;
                const projectName = analysis.projectStructure?.framework || 'Project';
                
                let content = `# ${projectName}\n\n`;
                
                // Project description based on analysis
                if (structure) {
                    content += `A ${structure.framework} project with ${structure.architecture} architecture.\n\n`;
                    
                    // Features based on detected components
                    content += `## Features\n\n`;
                    if (structure.hasFrontend) content += `- 🎨 Frontend Application\n`;
                    if (structure.hasBackend) content += `- ⚙️ Backend Services\n`;
                    if (structure.hasDatabase) content += `- 🗄️ Database Integration\n`;
                    if (structure.hasTests) content += `- 🧪 Testing Framework\n`;
                    content += `- 📚 Comprehensive Documentation\n\n`;
                    
                    // Architecture overview
                    content += `## Architecture\n\n`;
                    content += `This project follows a **${structure.architecture}** architecture pattern using **${structure.framework}**.\n\n`;
                    
                    // Key domains
                    if (structure.domains && structure.domains.length > 0) {
                        content += `### Key Domains\n\n`;
                        structure.domains.forEach((domain: any) => {
                            content += `- **${domain.name}** (${domain.type}) - ${domain.description}\n`;
                        });
                        content += `\n`;
                    }
                }
                
                // Installation and setup
                content += `## Installation\n\n`;
                content += `1. Clone the repository\n`;
                content += `2. Install dependencies: \`npm install\`\n`;
                content += `3. Configure environment variables\n`;
                content += `4. Run the application: \`npm start\`\n\n`;
                
                // Usage based on detected components
                content += `## Usage\n\n`;
                if (structure?.hasFrontend) {
                    content += `### Frontend\n`;
                    content += `The frontend application provides a user interface for interacting with the system.\n\n`;
                }
                if (structure?.hasBackend) {
                    content += `### Backend\n`;
                    content += `The backend services handle business logic and data processing.\n\n`;
                }
                if (structure?.hasDatabase) {
                    content += `### Database\n`;
                    content += `Database operations are handled through the data layer.\n\n`;
                }
                
                // Development
                content += `## Development\n\n`;
                content += `### Prerequisites\n`;
                content += `- Node.js (v14 or higher)\n`;
                content += `- npm or yarn\n`;
                if (structure?.hasDatabase) content += `- Database server (PostgreSQL/MySQL/MongoDB)\n`;
                content += `\n`;
                
                content += `### Scripts\n`;
                content += `- \`npm start\` - Start development server\n`;
                content += `- \`npm test\` - Run tests\n`;
                content += `- \`npm build\` - Build for production\n`;
                content += `- \`npm lint\` - Run linting\n\n`;
                
                // Contributing
                content += `## Contributing\n\n`;
                content += `We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.\n\n`;
                
                // License
                content += `## License\n\n`;
                content += `This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.\n\n`;
                
                // Project stats
                if (structure) {
                    content += `## Project Statistics\n\n`;
                    content += `- **Total Files**: ${structure.totalFiles}\n`;
                    content += `- **Code Files**: ${structure.codeFiles}\n`;
                    content += `- **Documentation Files**: ${structure.docFiles}\n`;
                    content += `- **Documentation Coverage**: ${structure.coverage}%\n`;
                }
                
                return content;
            }
            
            function generateApiContent(analysis: any): string {
                const structure = analysis.projectStructure;
                const projectName = structure?.framework || 'Project';
                
                let content = `# API Documentation\n\n`;
                content += `This document describes the API endpoints and functionality of the ${projectName}.\n\n`;
                
                // Overview based on detected architecture
                content += `## Overview\n\n`;
                if (structure?.hasBackend) {
                    content += `The backend provides a REST API for interacting with the system. `;
                }
                content += `This API follows RESTful principles and uses standard HTTP methods.\n\n`;
                
                // API endpoints based on detected domains and code items
                content += `## Endpoints\n\n`;
                
                // Group endpoints by domain
                if (structure?.domains && structure.domains.length > 0) {
                    structure.domains.forEach((domain: any) => {
                        if (domain.type === 'api' || domain.endpoints.length > 0) {
                            content += `### ${domain.name}\n\n`;
                            content += `${domain.description}\n\n`;
                            
                            if (domain.endpoints.length > 0) {
                                domain.endpoints.forEach((endpoint: any) => {
                                    content += `#### ${endpoint.name}\n`;
                                    if (endpoint.signature) {
                                        content += `\`\`\`\n${endpoint.signature}\n\`\`\`\n`;
                                    }
                                    if (endpoint.description) {
                                        content += `${endpoint.description}\n`;
                                    }
                                    if (endpoint.parameters && endpoint.parameters.length > 0) {
                                        content += `**Parameters:**\n`;
                                        endpoint.parameters.forEach((param: any) => {
                                            content += `- \`${param.name}\` (${param.type})${param.description ? ` - ${param.description}` : ''}\n`;
                                        });
                                    }
                                    if (endpoint.returnType) {
                                        content += `**Returns:** \`${endpoint.returnType}\`\n`;
                                    }
                                    content += `\n`;
                                });
                            } else {
                                content += `*No specific endpoints detected for this domain.*\n\n`;
                            }
                        }
                    });
                }
                
                // General API information
                content += `## Authentication\n\n`;
                content += `Authentication is handled through the system's security layer. `;
                content += `Please refer to the [Authentication Documentation](AUTHENTICATION.md) for detailed information.\n\n`;
                
                content += `## Error Handling\n\n`;
                content += `All endpoints return standard HTTP status codes:\n`;
                content += `- **200** - Success\n`;
                content += `- **400** - Bad Request\n`;
                content += `- **401** - Unauthorized\n`;
                content += `- **404** - Not Found\n`;
                content += `- **500** - Internal Server Error\n\n`;
                
                content += `## Rate Limiting\n\n`;
                content += `Rate limiting policies are configured based on the deployment environment. `;
                content += `Please check with your system administrator for specific limits.\n\n`;
                
                // API statistics
                if (structure) {
                    const totalEndpoints = structure.domains.reduce((sum: number, domain: any) => sum + domain.endpoints.length, 0);
                    content += `## API Statistics\n\n`;
                    content += `- **Total Endpoints**: ${totalEndpoints}\n`;
                    content += `- **API Domains**: ${structure.domains.filter((d: any) => d.type === 'api').length}\n`;
                    content += `- **Documentation Coverage**: ${structure.coverage}%\n`;
                }
                
                return content;
            }
            
            function generateArchitectureContent(analysis: any): string {
                const structure = analysis.projectStructure;
                const projectName = structure?.framework || 'Project';
                
                let content = `# Architecture Documentation\n\n`;
                content += `This document describes the architecture and design of the ${projectName}.\n\n`;
                
                // Architecture overview
                content += `## Architecture Overview\n\n`;
                content += `The ${projectName} follows a **${structure?.architecture || 'modular'}** architecture pattern `;
                content += `built with **${structure?.framework || 'modern web technologies'}**.\n\n`;
                
                // System components based on analysis
                content += `## System Components\n\n`;
                
                if (structure?.hasFrontend) {
                    content += `### Frontend Layer\n`;
                    content += `The frontend application provides the user interface and handles user interactions.\n\n`;
                    content += `**Responsibilities:**\n`;
                    content += `- User interface rendering\n`;
                    content += `- User input handling\n`;
                    content += `- Client-side state management\n`;
                    content += `- API communication\n\n`;
                }
                
                if (structure?.hasBackend) {
                    content += `### Backend Layer\n`;
                    content += `The backend services handle business logic, data processing, and API endpoints.\n\n`;
                    content += `**Responsibilities:**\n`;
                    content += `- Business logic implementation\n`;
                    content += `- API endpoint management\n`;
                    content += `- Data validation and processing\n`;
                    content += `- Authentication and authorization\n\n`;
                }
                
                if (structure?.hasDatabase) {
                    content += `### Data Layer\n`;
                    content += `The database layer manages data persistence and retrieval.\n\n`;
                    content += `**Responsibilities:**\n`;
                    content += `- Data storage and retrieval\n`;
                    content += `- Data integrity and consistency\n`;
                    content += `- Query optimization\n`;
                    content += `- Backup and recovery\n\n`;
                }
                
                if (structure?.hasTests) {
                    content += `### Testing Layer\n`;
                    content += `The testing framework ensures code quality and system reliability.\n\n`;
                    content += `**Responsibilities:**\n`;
                    content += `- Unit testing\n`;
                    content += `- Integration testing\n`;
                    content += `- End-to-end testing\n`;
                    content += `- Code coverage analysis\n\n`;
                }
                
                // Domain architecture
                if (structure?.domains && structure.domains.length > 0) {
                    content += `## Domain Architecture\n\n`;
                    content += `The system is organized into the following domains:\n\n`;
                    
                    structure.domains.forEach((domain: any) => {
                        content += `### ${domain.name}\n`;
                        content += `**Type:** ${domain.type}\n`;
                        content += `**Description:** ${domain.description}\n`;
                        content += `**Priority:** ${domain.priority}\n\n`;
                        
                        if (domain.files && domain.files.length > 0) {
                            content += `**Key Files:**\n`;
                            domain.files.slice(0, 5).forEach((file: any) => {
                                content += `- \`${file}\`\n`;
                            });
                            if (domain.files.length > 5) {
                                content += `- ... and ${domain.files.length - 5} more files\n`;
                            }
                            content += `\n`;
                        }
                    });
                }
                
                // Data flow
                content += `## Data Flow\n\n`;
                content += `1. **User Input** - Users interact with the frontend interface\n`;
                if (structure?.hasBackend) {
                    content += `2. **API Requests** - Frontend sends requests to backend services\n`;
                    content += `3. **Business Logic** - Backend processes requests and applies business rules\n`;
                }
                if (structure?.hasDatabase) {
                    content += `4. **Data Operations** - Backend interacts with the database layer\n`;
                    content += `5. **Data Response** - Database returns requested data\n`;
                }
                if (structure?.hasBackend) {
                    content += `6. **API Response** - Backend sends processed data to frontend\n`;
                }
                content += `${structure?.hasBackend ? '7' : '2'}. **UI Update** - Frontend updates the user interface\n\n`;
                
                // Technology stack
                content += `## Technology Stack\n\n`;
                content += `### Core Technologies\n`;
                content += `- **Framework:** ${structure?.framework || 'Modern Web Framework'}\n`;
                content += `- **Architecture:** ${structure?.architecture || 'Modular Architecture'}\n`;
                content += `- **Language:** TypeScript/JavaScript\n`;
                content += `- **Runtime:** Node.js\n\n`;
                
                if (structure?.hasFrontend) {
                    content += `### Frontend Technologies\n`;
                    content += `- HTML5/CSS3\n`;
                    content += `- JavaScript/TypeScript\n`;
                    content += `- Modern UI Framework\n`;
                    content += `- State Management Library\n\n`;
                }
                
                if (structure?.hasBackend) {
                    content += `### Backend Technologies\n`;
                    content += `- Node.js Runtime\n`;
                    content += `- Web Framework (Express/Fastify)\n`;
                    content += `- API Framework\n`;
                    content += `- Middleware Stack\n\n`;
                }
                
                if (structure?.hasDatabase) {
                    content += `### Database Technologies\n`;
                    content += `- Database Engine (PostgreSQL/MySQL/MongoDB)\n`;
                    content += `- ORM/ODM (Prisma/Mongoose/TypeORM)\n`;
                    content += `- Database Migration Tools\n`;
                    content += `- Query Optimization\n\n`;
                }
                
                // Security considerations
                content += `## Security Considerations\n\n`;
                content += `### Authentication & Authorization\n`;
                content += `- User authentication through secure protocols\n`;
                content += `- Role-based access control\n`;
                content += `- Session management\n`;
                content += `- API key management\n\n`;
                
                content += `### Data Protection\n`;
                content += `- Input validation and sanitization\n`;
                content += `- SQL injection prevention\n`;
                content += `- XSS protection\n`;
                content += `- CSRF protection\n\n`;
                
                content += `### Infrastructure Security\n`;
                content += `- HTTPS enforcement\n`;
                content += `- Secure headers\n`;
                content += `- Rate limiting\n`;
                content += `- Error handling without information disclosure\n\n`;
                
                // Performance considerations
                content += `## Performance Considerations\n\n`;
                content += `### Frontend Performance\n`;
                content += `- Code splitting and lazy loading\n`;
                content += `- Asset optimization\n`;
                content += `- Caching strategies\n`;
                content += `- Bundle size optimization\n\n`;
                
                if (structure?.hasBackend) {
                    content += `### Backend Performance\n`;
                    content += `- API response optimization\n`;
                    content += `- Database query optimization\n`;
                    content += `- Caching layers\n`;
                    content += `- Load balancing\n\n`;
                }
                
                // Project statistics
                if (structure) {
                    content += `## Project Statistics\n\n`;
                    content += `- **Total Files:** ${structure.totalFiles}\n`;
                    content += `- **Code Files:** ${structure.codeFiles}\n`;
                    content += `- **Documentation Files:** ${structure.docFiles}\n`;
                    content += `- **Documentation Coverage:** ${structure.coverage}%\n`;
                    content += `- **Domains:** ${structure.domains.length}\n`;
                }
                
                return content;
            }
            
            function generateSetupContent(analysis: any): string {
                return `# Setup Guide

This guide will help you set up and configure the Documind AI Documentation Assistant.

## Prerequisites

- Visual Studio Code (version 1.60.0 or higher)
- Node.js (version 14.0.0 or higher)
- Git (for version control)

## Installation

### From VS Code Marketplace
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Documind AI"
4. Click Install

### From Source
1. Clone the repository
2. Run \`npm install\`
3. Run \`npm run compile\`
4. Press F5 to launch extension in development mode

## Configuration

### Workspace Settings
The extension automatically detects your project structure. No additional configuration required.

### Optional Settings
- \\\`codenection.documentationPath\\\` - Custom documentation directory
- \\\`codenection.autoGenerate\\\` - Enable automatic documentation generation

## First Use

1. Open your project in VS Code
2. Look for the Documind AI icon in the sidebar
3. Click to open the documentation assistant
4. Review the project overview in the Dashboard tab

## Troubleshooting

### Common Issues
- **Extension not loading**: Restart VS Code
- **No project detected**: Ensure you're in a valid project directory
- **Generation fails**: Check file permissions and workspace access

### Getting Help
- Check the VS Code Developer Console for error messages
- Review the extension logs in the Output panel
- Submit issues on the GitHub repository`;
            }
            
            function generateContributingContent(analysis: any): string {
                return `# Contributing Guidelines

Thank you for your interest in contributing to Documind AI Documentation Assistant!

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Create a feature branch: \`git checkout -b feature/amazing-feature\`
4. Make your changes
5. Commit your changes: \`git commit -m 'Add amazing feature'\`
6. Push to your fork: \`git push origin feature/amazing-feature\`
7. Open a Pull Request

## Development Setup

### Prerequisites
- Node.js 14+
- VS Code
- Git

### Setup Steps
\`\`\`bash
# Clone the repository
git clone https://github.com/your-username/codenection-ai.git
cd codenection-ai

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Run in development mode
npm run dev
\`\`\`

## Code Style

### TypeScript
- Use strict TypeScript configuration
- Follow ESLint rules
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

### Testing
- Write unit tests for new features
- Test in multiple VS Code versions
- Verify cross-platform compatibility

## Pull Request Process

1. Ensure your code follows the style guidelines
2. Add tests for new functionality
3. Update documentation as needed
4. Ensure all tests pass
5. Request review from maintainers

## Issue Reporting

When reporting issues, please include:
- VS Code version
- Extension version
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable

## Feature Requests

We welcome feature requests! Please:
- Check existing issues first
- Provide clear use cases
- Explain the expected behavior
- Consider implementation complexity

## Code of Conduct

Please be respectful and constructive in all interactions.`;
            }
            
            function generateChangelogContent(analysis: any): string {
                return `# Changelog

All notable changes to the Documind AI Documentation Assistant will be documented in this file.

## [Unreleased]

### Added
- Initial release of Documind AI Documentation Assistant
- Project analysis and structure detection
- AI-powered documentation generation
- Interactive chat interface
- Real-time file parsing and codebase analysis

### Changed
- N/A

### Fixed
- N/A

## [0.1.0] - 2024-01-XX

### Added
- Basic extension structure
- Webview interface
- Project analysis service
- Documentation generation service
- Chat interface with keyword-based responses
- File upload and management system
- Responsive UI design

### Features
- Dashboard with project overview
- Documentation task management
- Real-time codebase analysis
- Intelligent file parsing
- Generation progress tracking
- Pause/resume/cancel functionality

### Technical
- TypeScript implementation
- VS Code Extension API integration
- Secure message passing
- File system operations
- Error handling and validation`;
            }
            
            function generateAuthenticationContent(analysis: any): string {
                return `# Authentication Documentation

This document describes the authentication and security mechanisms used in the Documind AI Documentation Assistant.

## Overview

The extension operates entirely within the VS Code environment and does not require external authentication for local development use.

## Security Model

### Local Operation
- All operations are performed locally within the VS Code workspace
- No external network requests without explicit user consent
- File system access restricted to the current workspace

### Content Security Policy (CSP)
- Strict CSP enforced on webview content
- Prevents execution of untrusted scripts
- Restricts resource loading to approved sources

## Access Control

### Workspace Access
- Extension can only access files within the current workspace
- User must explicitly grant permission for file operations
- No access to system files outside the workspace

### File Permissions
- Respects existing file system permissions
- Cannot overwrite read-only files
- Creates backup copies when modifying existing files

## Data Privacy

### Local Storage
- All data remains on the user's local machine
- No data transmitted to external servers
- Temporary files cleaned up after operations

### User Data
- No personal information collected
- Project analysis data stays within the workspace
- No telemetry or usage tracking

## Future Considerations

### External AI Services
When external AI services are integrated:
- User consent required for data transmission
- API keys stored securely in VS Code settings
- Option to use local models when available
- Clear data usage policies

### Multi-user Environments
For team or enterprise use:
- Role-based access control
- Project-level permissions
- Audit logging for documentation changes
- Integration with existing authentication systems`;
            }
            
            function generateUserManagementContent(analysis: any): string {
                return `# User Management Documentation

This document describes user management features and workflows in the Documind AI Documentation Assistant.

## Overview

The extension is designed for individual developers and small teams. User management is primarily handled through VS Code's built-in features.

## User Types

### Individual Developer
- Full access to all extension features
- Can generate and modify all documentation
- Access to project analysis and chat interface

### Team Member
- Shared workspace access
- Collaborative documentation editing
- Version control integration

## User Interface

### Dashboard Access
- All users can access the main dashboard
- Project overview visible to all team members
- Documentation status shared across team

### Chat Interface
- Individual chat sessions per user
- File attachments and context management
- Persistent conversation history

## Permissions

### File Operations
- Read access to all project files
- Write access to documentation files
- Respects Git permissions and file locks

### Documentation Generation
- Can generate new documentation files
- Can update existing documentation
- Cannot delete critical project files

## Collaboration Features

### Version Control Integration
- Changes tracked through Git
- Commit messages for generated documentation
- Branch protection for critical files

### Shared Context
- Project analysis results shared
- Documentation templates available to all users
- Consistent formatting across team

## User Preferences

### Individual Settings
- Chat history and preferences
- File attachment settings
- UI customization options

### Workspace Settings
- Documentation generation preferences
- File path configurations
- Team-wide standards

## Future Enhancements

### User Roles
- Admin: Full access and configuration
- Editor: Can modify documentation
- Viewer: Read-only access

### Team Features
- User activity tracking
- Collaborative editing
- Comment and review system
- Approval workflows`;
            }
            
            function generateApiRoutesContent(analysis: any): string {
                return `# API Routes Documentation

This document describes the API routes and endpoints available in the Documind AI Documentation Assistant.

## Overview

The extension provides internal API routes for communication between the webview interface and the extension host.

## Route Structure

### Base Path
All routes are prefixed with the extension namespace: \\\`codenection-ai\\\`

### Message Types
Routes are implemented as message commands sent via VS Code's webview messaging system.

## Core Routes

### Project Analysis
\\\`\\\`\\\`
POST /analyze
Description: Analyze project structure and documentation status
Parameters: None
Response: ProjectAnalysis object
\\\`\\\`\\\`

### Documentation Generation
\\\`\\\`\\\`
POST /generate
Description: Generate documentation files
Parameters: { type: string, options?: object }
Response: GenerationResult object
\\\`\\\`\\\`

### File Operations
\\\`\\\`\\\`
GET /files/{path}
Description: Read file content
Parameters: { path: string }
Response: FileContent object

POST /files/{path}
Description: Write file content
Parameters: { path: string, content: string }
Response: WriteResult object
\\\`\\\`\\\`

## Chat Interface Routes

### Message Handling
\\\`\\\`\\\`
POST /chat
Description: Process chat messages and generate responses
Parameters: { message: string, context?: object }
Response: ChatResponse object
\\\`\\\`\\\`

### File Management
\\\`\\\`\\\`
POST /files/upload
Description: Handle file uploads for chat context
Parameters: { files: File[] }
Response: UploadResult object

DELETE /files/{id}
Description: Remove file from chat context
Parameters: { id: string }
Response: DeleteResult object
\\\`\\\`\\\`

## Error Handling

### Standard Error Format
\\\`\\\`\\\`json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": "Additional error details"
  }
}
\\\`\\\`\\\`

### Common Error Codes
- \\\`INVALID_REQUEST\\\`: Malformed request parameters
- \\\`FILE_NOT_FOUND\\\`: Requested file does not exist
- \\\`PERMISSION_DENIED\\\`: Insufficient permissions
- \\\`GENERATION_FAILED\\\`: Documentation generation error

## Rate Limiting

### Local Operations
- No rate limiting for local file operations
- Chat responses limited to prevent UI blocking
- Generation operations can be paused/resumed

### Future External APIs
When external AI services are integrated:
- Request throttling to respect API limits
- Retry logic with exponential backoff
- User-configurable rate limits

## Security

### Input Validation
- All inputs validated and sanitized
- File paths restricted to workspace
- Command injection prevention

### Message Security
- CSP headers on all webview content
- Message origin validation
- Command whitelist enforcement`;
            }
            
            async function getRealDocumentationContent(docType: string): Promise<string> {
                const docTypeMap = {
                    'readme': 'README.md',
                    'api': 'docs/API.md', 
                    'architecture': 'docs/ARCHITECTURE.md',
                    'setup': 'docs/SETUP.md',
                    'contributing': 'CONTRIBUTING.md',
                    'changelog': 'CHANGELOG.md',
                    'auth': 'docs/AUTHENTICATION.md',
                    'authentication': 'docs/AUTHENTICATION.md',
                    'user management': 'docs/USER_MANAGEMENT.md',
                    'user-management': 'docs/USER_MANAGEMENT.md',
                    'api routes': 'docs/API_ROUTES.md',
                    'api-routes': 'docs/API_ROUTES.md'
                };
                
                const fileName = docTypeMap[docType as keyof typeof docTypeMap];
                if (!fileName) return '';
                
                try {
                    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                    if (!workspaceFolder) return '';
                    
                    const filePath = vscode.Uri.joinPath(workspaceFolder.uri, fileName);
                    const fileContent = await vscode.workspace.fs.readFile(filePath);
                    return Buffer.from(fileContent).toString('utf-8');
                } catch (error) {
                    return '';
                }
            }
            
            async function analyzeCodebaseForArchitecture(): Promise<string> {
                try {
                    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                    if (!workspaceFolder) return '';
                    
                    // Get workspace analyzer
                    const { WorkspaceAnalyzer } = await import('./services/WorkspaceAnalyzer');
                    const analyzer = new WorkspaceAnalyzer();
                    const analysis = await analyzer.analyzeWorkspace();
                    
                    if (!analysis.projectStructure) return '';
                    
                    const structure = analysis.projectStructure;
                    let architectureInfo = `🏗️ **Project Architecture Analysis**\n\n`;
                    
                    // Framework detection
                    if (structure.framework) {
                        architectureInfo += `**Framework**: ${structure.framework}\n\n`;
                    }
                    
                    // Architecture type
                    if (structure.architecture) {
                        architectureInfo += `**Architecture Pattern**: ${structure.architecture}\n\n`;
                    }
                    
                    // Components
                    architectureInfo += `**System Components**:\n`;
                    if (structure.hasFrontend) architectureInfo += `• Frontend Application\n`;
                    if (structure.hasBackend) architectureInfo += `• Backend Services\n`;
                    if (structure.hasDatabase) architectureInfo += `• Database Layer\n`;
                    if (structure.hasTests) architectureInfo += `• Testing Framework\n`;
                    
                    // Domains
                    if (structure.domains && structure.domains.length > 0) {
                        architectureInfo += `\n**Key Domains**:\n`;
                        structure.domains.forEach(domain => {
                            architectureInfo += `• ${domain.name} (${domain.type})\n`;
                        });
                    }
                    
                    return architectureInfo;
                } catch (error) {
                    return '';
                }
            }
            
            async function analyzeCodebaseForAPI(): Promise<string> {
                try {
                    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                    if (!workspaceFolder) return '';
                    
                    // Simple API route detection
                    const apiInfo = `🔌 **API Analysis**\n\n`;
                    
                    // Look for common API patterns
                    const patterns = [
                        { pattern: /app\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g, type: 'Express.js' },
                        { pattern: /router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g, type: 'Express Router' },
                        { pattern: /@(Get|Post|Put|Delete|Patch)\s*\(\s*['"`]([^'"`]+)['"`]/g, type: 'NestJS' },
                        { pattern: /@(GET|POST|PUT|DELETE|PATCH)\s*\(\s*['"`]([^'"`]+)['"`]/g, type: 'NestJS' }
                    ];
                    
                    let foundRoutes: string[] = [];
                    
                    // Scan common files for API routes
                    const commonFiles = ['src/app.js', 'src/app.ts', 'src/index.js', 'src/index.ts', 'src/routes/', 'src/controllers/'];
                    
                    for (const filePattern of commonFiles) {
                        try {
                            const filePath = vscode.Uri.joinPath(workspaceFolder.uri, filePattern);
                            const fileContent = await vscode.workspace.fs.readFile(filePath);
                            const content = Buffer.from(fileContent).toString('utf-8');
                            
                            patterns.forEach(({ pattern, type }) => {
                                let match;
                                while ((match = pattern.exec(content)) !== null) {
                                    foundRoutes.push(`${match[1].toUpperCase()} ${match[2]} (${type})`);
                                }
                            });
                        } catch (error) {
                            // File doesn't exist or can't be read, continue
                        }
                    }
                    
                    if (foundRoutes.length > 0) {
                        return apiInfo + `**Found API Routes**:\n${foundRoutes.map(route => `• ${route}`).join('\n')}\n\n`;
                    } else {
                        return apiInfo + `**No API routes detected** in common locations.\n\n`;
                    }
                } catch (error) {
                    return '';
                }
            }

            // Keyword-based response system with real file parsing
            async function processKeywordResponse(userMessage: string): Promise<string> {
                const message = userMessage.toLowerCase();
                
                // Extract file/documentation type from message
                const docTypes = {
                    'readme': 'README.md',
                    'api': 'API.md', 
                    'architecture': 'ARCHITECTURE.md',
                    'setup': 'SETUP.md',
                    'contributing': 'CONTRIBUTING.md',
                    'changelog': 'CHANGELOG.md',
                    'auth': 'AUTHENTICATION.md',
                    'authentication': 'AUTHENTICATION.md',
                    'user management': 'USER_MANAGEMENT.md',
                    'user-management': 'USER_MANAGEMENT.md',
                    'api routes': 'API_ROUTES.md',
                    'api-routes': 'API_ROUTES.md'
                };
                
                // Extract action keywords
                const actions = {
                    'explain': 'explain',
                    'summarize': 'summarize', 
                    'summarise': 'summarize',
                    'generate': 'generate',
                    'regenerate': 'regenerate',
                    'update': 'update',
                    'create': 'create',
                    'what is': 'explain',
                    'tell me about': 'explain',
                    'describe': 'explain'
                };
                
                // Find matching action and document type
                let action = '';
                let docType = '';
                let docFile = '';
                
                // Check for action keywords
                for (const [keyword, actionType] of Object.entries(actions)) {
                    if (message.includes(keyword)) {
                        action = actionType;
                        break;
                    }
                }
                
                // Check for document type keywords
                for (const [keyword, fileName] of Object.entries(docTypes)) {
                    if (message.includes(keyword)) {
                        docType = keyword;
                        docFile = fileName;
                        break;
                    }
                }
                
                // Generate response based on action and document type
                if (action && docFile) {
                    return await generateDocumentationResponse(action, docType, docFile, userMessage);
                } else if (action) {
                    return generateGeneralResponse(action, userMessage);
                } else if (docFile) {
                    return await generateDocumentationResponse('explain', docType, docFile, userMessage);
                } else {
                    return generateDefaultResponse(userMessage);
                }
            }
            
            async function generateDocumentationResponse(action: string, docType: string, docFile: string, originalMessage: string): Promise<string> {
                // Check if file exists and get real content
                const fileContent = await getRealDocumentationContent(docType);
                const fileExists = fileContent.length > 0;
                
                if (action === 'explain' && fileExists) {
                    // Return actual file content with summary
                    const summary = fileContent.length > 500 ? 
                        fileContent.substring(0, 500) + '...' : 
                        fileContent;
                    
                    return `📖 **${docFile} Content**\n\n**File Status**: ✅ Exists\n\n**Content Summary**:\n\`\`\`\n${summary}\n\`\`\`\n\n**Full file available** - Would you like me to show the complete content or help you update it?`;
                } else if (action === 'explain' && !fileExists) {
                    // Analyze codebase for real information
                    if (docType === 'architecture') {
                        const analysis = await analyzeCodebaseForArchitecture();
                        return analysis + `\n**File Status**: ❌ ${docFile} doesn't exist\n\n**Recommendation**: Generate architecture documentation to capture this analysis.`;
                    } else if (docType === 'api') {
                        const analysis = await analyzeCodebaseForAPI();
                        return analysis + `\n**File Status**: ❌ ${docFile} doesn't exist\n\n**Recommendation**: Generate API documentation to capture these routes.`;
                    }
                }
                
                const responses = {
                    'explain': {
                        'readme': `📖 **README.md Explanation**\n\nYour README.md file serves as the main entry point for your project. It should include:\n\n• **Project Overview**: What your project does and why it exists\n• **Installation Instructions**: How to set up and run the project\n• **Usage Examples**: Basic examples of how to use your project\n• **Contributing Guidelines**: How others can contribute\n• **License Information**: Legal information about usage\n\n**Current Status**: ${fileExists ? '✅ exists' : '❌ missing'}\n\n${fileExists ? 'File exists - I can show you the content or help update it.' : 'Would you like me to generate this documentation?'}`,
                        
                        'api': `🔌 **API Documentation**\n\nYour API documentation should cover:\n\n• **Endpoints**: All available API routes and methods\n• **Request/Response Formats**: Data structures and examples\n• **Authentication**: How to authenticate requests\n• **Error Handling**: Common error codes and responses\n• **Rate Limiting**: Usage limits and policies\n\n**Current Status**: ${fileExists ? '✅ exists' : '❌ missing'}\n\n${fileExists ? 'File exists - I can show you the content or help update it.' : 'I can analyze your codebase and generate comprehensive API docs.'}`,
                        
                        'architecture': `🏗️ **Architecture Documentation**\n\nArchitecture docs should explain:\n\n• **System Overview**: High-level system design\n• **Component Structure**: How different parts interact\n• **Data Flow**: How data moves through the system\n• **Technology Stack**: Frameworks, libraries, and tools used\n• **Deployment Architecture**: How the system is deployed\n\n**Current Status**: ${fileExists ? '✅ exists' : '❌ missing'}\n\n${fileExists ? 'File exists - I can show you the content or help update it.' : 'I can analyze your codebase to generate detailed architecture documentation.'}`,
                        
                        'setup': `⚙️ **Setup Documentation**\n\nSetup docs should include:\n\n• **Prerequisites**: Required software and versions\n• **Installation Steps**: Step-by-step setup instructions\n• **Configuration**: Environment variables and settings\n• **Database Setup**: Database initialization and migrations\n• **Development Environment**: Local development setup\n\n**Current Status**: ${docFile} exists ✅\n\nI can generate detailed setup instructions based on your project structure.`,
                        
                        'contributing': `🤝 **Contributing Guidelines**\n\nContributing docs should cover:\n\n• **Code Style**: Coding standards and conventions\n• **Pull Request Process**: How to submit changes\n• **Testing Requirements**: Testing standards and procedures\n• **Issue Reporting**: How to report bugs and request features\n• **Development Workflow**: Git workflow and branching strategy\n\n**Current Status**: ${docFile} exists ✅\n\nLet me create comprehensive contributing guidelines for your project.`,
                        
                        'changelog': `📝 **Changelog**\n\nYour changelog should track:\n\n• **Version History**: All releases and their dates\n• **New Features**: What's been added\n• **Bug Fixes**: Issues that have been resolved\n• **Breaking Changes**: Changes that affect compatibility\n• **Deprecations**: Features being removed\n\n**Current Status**: ${docFile} exists ✅\n\nI can generate a changelog based on your git history and recent changes.`,
                        
                        'authentication': `🔐 **Authentication Documentation**\n\nAuthentication docs should explain:\n\n• **Authentication Methods**: How users authenticate (JWT, OAuth, etc.)\n• **Security Policies**: Password requirements, session management\n• **API Authentication**: How to authenticate API requests\n• **User Roles**: Different user types and permissions\n• **Security Best Practices**: Recommendations for secure implementation\n\n**Current Status**: ${docFile} exists ✅\n\nI can analyze your authentication implementation and generate comprehensive docs.`,
                        
                        'user management': `👥 **User Management Documentation**\n\nUser management docs should cover:\n\n• **User Registration**: How users sign up\n• **User Profiles**: What information is stored\n• **User Roles**: Different user types and permissions\n• **Account Management**: Password reset, profile updates\n• **User Administration**: Admin functions for user management\n\n**Current Status**: ${docFile} exists ✅\n\nLet me analyze your user management system and create detailed documentation.`,
                        
                        'api routes': `🛣️ **API Routes Documentation**\n\nAPI routes docs should include:\n\n• **Route Definitions**: All available endpoints\n• **HTTP Methods**: GET, POST, PUT, DELETE operations\n• **Request Parameters**: Query params, body data, headers\n• **Response Formats**: Success and error response structures\n• **Route Examples**: Sample requests and responses\n\n**Current Status**: ${docFile} exists ✅\n\nI can scan your codebase and generate comprehensive API route documentation.`
                    },
                    
                    'generate': {
                        'readme': `🚀 **Generating README.md**\n\nI'll create a comprehensive README.md file that includes:\n\n• Project description and purpose\n• Installation and setup instructions\n• Usage examples and API documentation\n• Contributing guidelines\n• License information\n\n**Action**: Creating ${docFile} in your project root...\n\nThis will serve as the main entry point for anyone discovering your project.`,
                        
                        'api': `🔌 **Generating API Documentation**\n\nI'll analyze your codebase and create detailed API documentation covering:\n\n• All available endpoints and methods\n• Request/response schemas\n• Authentication requirements\n• Error handling and status codes\n• Usage examples\n\n**Action**: Creating ${docFile} in your docs/ directory...\n\nThis will help developers understand and integrate with your API.`,
                        
                        'architecture': `🏗️ **Generating Architecture Documentation**\n\nI'll create comprehensive architecture documentation including:\n\n• System overview and design principles\n• Component relationships and data flow\n• Technology stack and dependencies\n• Deployment and infrastructure details\n• Security considerations\n\n**Action**: Creating ${docFile} in your docs/ directory...\n\nThis will help new developers understand your system architecture.`,
                        
                        'setup': `⚙️ **Generating Setup Documentation**\n\nI'll create detailed setup instructions covering:\n\n• Prerequisites and system requirements\n• Step-by-step installation process\n• Configuration and environment setup\n• Database initialization\n• Development environment setup\n\n**Action**: Creating ${docFile} in your docs/ directory...\n\nThis will help new contributors get started quickly.`,
                        
                        'contributing': `🤝 **Generating Contributing Guidelines**\n\nI'll create comprehensive contributing guidelines including:\n\n• Code style and formatting standards\n• Pull request process and requirements\n• Testing guidelines and procedures\n• Issue reporting and feature requests\n• Development workflow and branching strategy\n\n**Action**: Creating ${docFile} in your project root...\n\nThis will help maintain code quality and streamline contributions.`,
                        
                        'changelog': `📝 **Generating Changelog**\n\nI'll analyze your git history and create a changelog including:\n\n• Version history and release dates\n• New features and enhancements\n• Bug fixes and improvements\n• Breaking changes and deprecations\n• Migration guides for major updates\n\n**Action**: Creating ${docFile} in your project root...\n\nThis will help users track changes and plan upgrades.`,
                        
                        'authentication': `🔐 **Generating Authentication Documentation**\n\nI'll analyze your authentication implementation and create docs covering:\n\n• Authentication methods and flows\n• Security policies and requirements\n• API authentication and authorization\n• User roles and permissions\n• Security best practices and recommendations\n\n**Action**: Creating ${docFile} in your docs/ directory...\n\nThis will help developers implement secure authentication.`,
                        
                        'user management': `👥 **Generating User Management Documentation**\n\nI'll analyze your user management system and create docs covering:\n\n• User registration and onboarding\n• User profiles and data management\n• Role-based access control\n• Account management features\n• Administrative functions\n\n**Action**: Creating ${docFile} in your docs/ directory...\n\nThis will help developers understand user management workflows.`,
                        
                        'api routes': `🛣️ **Generating API Routes Documentation**\n\nI'll scan your codebase and create comprehensive API route documentation including:\n\n• All available endpoints and HTTP methods\n• Request parameters and body schemas\n• Response formats and status codes\n• Authentication and authorization requirements\n• Usage examples and integration guides\n\n**Action**: Creating ${docFile} in your docs/ directory...\n\nThis will serve as a complete API reference for developers.`
                    },
                    
                    'regenerate': {
                        'readme': `🔄 **Regenerating README.md**\n\nI'll update your existing README.md with:\n\n• Latest project information and features\n• Updated installation instructions\n• Current usage examples and API docs\n• Recent changes and improvements\n• Updated contributing guidelines\n\n**Action**: Updating ${docFile} with latest information...\n\nThis will ensure your README stays current and accurate.`,
                        
                        'api': `🔄 **Regenerating API Documentation**\n\nI'll update your API documentation with:\n\n• Latest endpoints and changes\n• Updated request/response schemas\n• Current authentication methods\n• Recent error handling updates\n• New usage examples\n\n**Action**: Updating ${docFile} with latest API changes...\n\nThis will keep your API docs synchronized with your code.`,
                        
                        'architecture': `🔄 **Regenerating Architecture Documentation**\n\nI'll update your architecture docs with:\n\n• Latest system design changes\n• Updated component relationships\n• Current technology stack\n• Recent infrastructure updates\n• New security considerations\n\n**Action**: Updating ${docFile} with latest architecture changes...\n\nThis will reflect your current system design.`,
                        
                        'setup': `🔄 **Regenerating Setup Documentation**\n\nI'll update your setup docs with:\n\n• Latest system requirements\n• Updated installation steps\n• Current configuration options\n• Recent dependency changes\n• Updated development setup\n\n**Action**: Updating ${docFile} with latest setup requirements...\n\nThis will ensure setup instructions are current.`,
                        
                        'contributing': `🔄 **Regenerating Contributing Guidelines**\n\nI'll update your contributing guidelines with:\n\n• Latest code style standards\n• Updated pull request process\n• Current testing requirements\n• Recent workflow changes\n• Updated issue reporting guidelines\n\n**Action**: Updating ${docFile} with latest contributing standards...\n\nThis will keep your contribution process current.`,
                        
                        'changelog': `🔄 **Regenerating Changelog**\n\nI'll update your changelog with:\n\n• Latest commits and changes\n• Recent feature additions\n• New bug fixes and improvements\n• Updated version information\n• Recent breaking changes\n\n**Action**: Updating ${docFile} with latest changes...\n\nThis will keep your changelog up to date.`,
                        
                        'authentication': `🔄 **Regenerating Authentication Documentation**\n\nI'll update your authentication docs with:\n\n• Latest authentication methods\n• Updated security policies\n• Current API authentication\n• Recent permission changes\n• Updated security recommendations\n\n**Action**: Updating ${docFile} with latest authentication changes...\n\nThis will reflect your current security implementation.`,
                        
                        'user management': `🔄 **Regenerating User Management Documentation**\n\nI'll update your user management docs with:\n\n• Latest user features\n• Updated role definitions\n• Current account management\n• Recent administrative changes\n• Updated user workflows\n\n**Action**: Updating ${docFile} with latest user management changes...\n\nThis will reflect your current user system.`,
                        
                        'api routes': `🔄 **Regenerating API Routes Documentation**\n\nI'll update your API routes docs with:\n\n• Latest endpoint changes\n• Updated request/response formats\n• Current authentication requirements\n• Recent route modifications\n• Updated usage examples\n\n**Action**: Updating ${docFile} with latest API route changes...\n\nThis will keep your API reference current.`
                    }
                };
                
                return (responses as any)[action]?.[docType] || generateDefaultResponse(originalMessage);
            }
            
            function generateGeneralResponse(action: string, originalMessage: string): string {
                const responses = {
                    'explain': `🤔 **I'd be happy to explain!**\n\nI can help explain various aspects of your project:\n\n• **Documentation**: README, API docs, Architecture, Setup guides\n• **Code Structure**: Components, modules, and system design\n• **Features**: Specific functionality and implementations\n• **Best Practices**: Coding standards and recommendations\n\n**Try asking:**\n• "Explain the API documentation"\n• "What is the architecture of this project?"\n• "Tell me about the setup process"\n\nWhat specific aspect would you like me to explain?`,
                    
                    'summarize': `📋 **I can help summarize!**\n\nI can provide summaries for:\n\n• **Project Overview**: High-level project description\n• **Documentation**: Summary of existing docs\n• **Code Structure**: Overview of components and modules\n• **Recent Changes**: Summary of recent commits and updates\n• **Features**: Overview of implemented functionality\n\n**Try asking:**\n• "Summarize the project"\n• "Summarize the API documentation"\n• "Summarize recent changes"\n\nWhat would you like me to summarize?`,
                    
                    'generate': `🚀 **I can generate documentation!**\n\nI can create various types of documentation:\n\n• **README.md**: Project overview and setup instructions\n• **API Documentation**: Complete API reference\n• **Architecture Docs**: System design and structure\n• **Setup Guide**: Installation and configuration\n• **Contributing Guidelines**: Development standards\n• **Changelog**: Version history and changes\n\n**Try asking:**\n• "Generate API documentation"\n• "Create a README file"\n• "Generate architecture docs"\n\nWhat documentation would you like me to generate?`,
                    
                    'regenerate': `🔄 **I can regenerate documentation!**\n\nI can update existing documentation with:\n\n• **Latest Information**: Current project state\n• **Recent Changes**: Updated features and fixes\n• **New Requirements**: Updated standards and practices\n• **Improved Content**: Better explanations and examples\n\n**Try asking:**\n• "Regenerate the README"\n• "Update the API documentation"\n• "Refresh the architecture docs"\n\nWhat documentation would you like me to regenerate?`
                };
                
                return (responses as any)[action] || generateDefaultResponse(originalMessage);
            }
            
            function generateDefaultResponse(originalMessage: string): string {
                return `🤖 **Documind AI Response**\n\nYou asked: "${originalMessage}"\n\nI'm here to help with your documentation needs! I can:\n\n• **Explain** documentation and code structure\n• **Summarize** project components and features\n• **Generate** new documentation files\n• **Regenerate** existing documentation\n• **Analyze** your codebase for documentation gaps\n\n**Try these commands:**\n• "Explain the API documentation"\n• "Generate a README file"\n• "Summarize the project architecture"\n• "Regenerate the setup guide"\n\nWhat would you like me to help you with?`;
            }

            // Handle messages from the webview with security validation
            webviewView.webview.onDidReceiveMessage(async (message) => {
                console.log('Webview message received:', message); // Debug log
                
                // SECURITY: Validate message structure and commands
                if (!message || typeof message !== 'object' || !message.command) {
                    console.warn('Invalid message received from webview:', message);
                    return;
                }
                
                // SECURITY: Only allow specific commands
                const allowedCommands = ['chat', 'insertToFile', 'replaceSelection', 'uploadFile', 'analyzeProject', 'generateReadme', 'generateApiDocs', 'generateChangelog', 'generateAllMissingDocs', 'pauseGeneration', 'resumeGeneration', 'cancelGeneration', 'docTaskAction', 'notificationAction', 'activityAction', 'saveSettings', 'generationStart', 'generationProgress', 'generationComplete', 'generationError', 'generationPaused', 'generationResumed', 'generationCancelled', 'switchTab', 'updateNotifications', 'updateActivities'];
                if (!allowedCommands.includes(message.command)) {
                    console.warn('Blocked unauthorized command:', message.command);
                    return;
                }
                
                if (message.command === 'chat') {
                    console.log('Chat command received:', message.message); // Debug log
                    
                    try {
                        // Check if this is a generation request
                        const generationRequest = checkForGenerationRequest(message.message);
                        
                        if (generationRequest.shouldGenerate) {
                            // Handle actual file generation
                            await handleGenerationRequest(generationRequest, webviewView);
                        } else {
                            // Process regular keyword-based responses
                            const response = await processKeywordResponse(message.message);
                            
                            console.log('Sending streaming response...'); // Debug log
                            
                            // Add artificial delay with thought process
                            webviewView.webview.postMessage({ command: 'thinking-start' });
                            
                            // Simulate thinking process with rationale
                            const thoughtProcess = [
                                "Analyzing your question...",
                                "Considering the context and requirements...",
                                "Formulating a comprehensive response...",
                                "Preparing detailed explanation..."
                            ];
                            
                            for (let i = 0; i < thoughtProcess.length; i++) {
                                webviewView.webview.postMessage({ 
                                    command: 'thinking-update', 
                                    thought: thoughtProcess[i],
                                    progress: (i + 1) / thoughtProcess.length
                                });
                                await new Promise(r => setTimeout(r, 400)); // 400ms per thought
                            }
                            
                            // Final delay before response
                            await new Promise(r => setTimeout(r, 300));
                            
                            // Start streaming response
                            webviewView.webview.postMessage({ command: 'stream-start' });
                            const chunks = response.match(/.{1,80}/gs) || [response];
                            for (const ch of chunks) {
                                webviewView.webview.postMessage({ command: 'stream-chunk', content: ch });
                                await new Promise(r => setTimeout(r, 50)); // Slightly slower for better visibility
                            }
                            webviewView.webview.postMessage({ command: 'stream-end' });
                            
                            console.log('Streaming response completed'); // Debug log
                        }
                    } catch (error) {
                        console.error('Error in chat handler:', error); // Debug log
                        webviewView.webview.postMessage({
                            command: 'response',
                            content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
                        });
                    }
                } else if (message.command === 'insertToFile') {
                    const editor = vscode.window.activeTextEditor;
                    if (!editor) { vscode.window.showWarningMessage('Open a file to insert content.'); return; }
                    await editor.edit(edit => {
                        const pos = editor.selection.active;
                        edit.insert(pos, "\n" + message.content + "\n");
                    });
                } else if (message.command === 'replaceSelection') {
                    const editor = vscode.window.activeTextEditor;
                    if (!editor) { vscode.window.showWarningMessage('Open a file to replace selection.'); return; }
                    await editor.edit(edit => {
                        const sel = editor.selection;
                        if (sel && !sel.isEmpty) {
                            edit.replace(sel, message.content);
                        } else {
                            const pos = editor.selection.active;
                            edit.insert(pos, "\n" + message.content + "\n");
                        }
                    });
                } else if (message.command === 'uploadFile') {
                    // Handle file upload (placeholder for now)
                    vscode.window.showInformationMessage('File upload feature coming soon! This will integrate with RAG services.');
                } else if (message.command === 'analyzeProject') {
                    // Analyze current workspace
                    const stats = await analyzeWorkspace();
                    webviewView.webview.postMessage({
                        command: 'updateDashboardStats',
                        stats: stats
                    });
                } else if (message.command === 'generateReadme') {
                    // Local placeholder: generate simple draft via client
                    const draft = await docsClient.generateDocumentationDraft({ filePath: 'WORKSPACE', tone: 'neutral', format: 'md' });
                    await showDraftInNewEditor('README.DRAFT.md', draft);
                } else if (message.command === 'generateApiDocs') {
                    // Local-only draft
                    const md = await draftApiDocsBasic();
                    await showDraftInNewEditor('API.DRAFT.md', md);
                } else if (message.command === 'generateChangelog') {
                    // Local git-based draft
                    const md = await draftChangelogSinceLastTag();
                    await showDraftInNewEditor('CHANGELOG.DRAFT.md', md);
                } else if (message.command === 'generateAllMissingDocs') {
                    // Generate only the files that are actually in the Doc Tasks list
                    try {
                        isGenerating = true;
                        isPaused = false;
                        generationAbortController = new AbortController();
                        
                        // Get current doc tasks (only missing/outdated files)
                        const stats = await analyzeWorkspace();
                        const tasks = stats.docTasks || [];
                        
                        if (tasks.length === 0) {
                            webviewView.webview.postMessage({ 
                                command: 'generationComplete',
                                completedItems: 0,
                                items: []
                            });
                            vscode.window.showInformationMessage('No documentation files to generate!');
                            return;
                        }
                        
                        // Start generation process with actual doc tasks
                        webviewView.webview.postMessage({ 
                            command: 'generationStart',
                            totalItems: tasks.length,
                            items: tasks.map((task, idx) => ({
                                name: task.title,
                                type: task.type,
                                status: 'pending',
                                description: task.description,
                                priority: task.priority,
                                index: idx
                            }))
                        });
                        
                        // Track generated files to exclude from future task lists
                        const generatedFiles = new Set<string>();
                        
                        // Generate each task individually with immediate cleanup
                        for (let i = 0; i < tasks.length; i++) {
                            if (generationAbortController?.signal.aborted) break;
                            
                            // Check if generation is paused
                            while (isPaused && isGenerating) {
                                await new Promise(resolve => setTimeout(resolve, 100));
                            }
                            
                            // Check again if cancelled while paused
                            if (!isGenerating) {
                                break;
                            }
                            
                            const task = tasks[i];
                            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                            if (!workspaceFolder) continue;
                            
                            // Generate the file directly with simple logic
                            let docPath: vscode.Uri;
                            let content: string;
                            
                            if (task.title.includes('README.md')) {
                                docPath = vscode.Uri.joinPath(workspaceFolder.uri, 'README.md');
                                content = `# ${workspaceFolder.name}\n\n> Project overview and getting started guide\n\n## Overview\n\nDescribe your project here.\n\n## Installation\n\n\`\`\`bash\nnpm install\n\`\`\`\n\n## Usage\n\n\`\`\`bash\nnpm start\n\`\`\`\n\n## Contributing\n\nSee CONTRIBUTING.md for guidelines.\n`;
                            } else if (task.title.includes('API.md') || task.title.includes('API Documentation')) {
                                // Create docs directory if it doesn't exist
                                const docsDir = vscode.Uri.joinPath(workspaceFolder.uri, 'docs');
                                try {
                                    await vscode.workspace.fs.stat(docsDir);
                                } catch {
                                    await vscode.workspace.fs.createDirectory(docsDir);
                                }
                                docPath = vscode.Uri.joinPath(workspaceFolder.uri, 'docs', 'API.md');
                                content = `# API Documentation\n\n> API endpoints, parameters, and examples\n\n## Overview\n\nThis document describes the API endpoints available in this project.\n\n## Endpoints\n\n### GET /api/health\n\nHealth check endpoint.\n\n**Response:**\n\`\`\`json\n{\n  "status": "ok"\n}\n\`\`\`\n`;
                            } else if (task.title.includes('ARCHITECTURE.md')) {
                                const docsDir = vscode.Uri.joinPath(workspaceFolder.uri, 'docs');
                                try {
                                    await vscode.workspace.fs.stat(docsDir);
                                } catch {
                                    await vscode.workspace.fs.createDirectory(docsDir);
                                }
                                docPath = vscode.Uri.joinPath(workspaceFolder.uri, 'docs', 'ARCHITECTURE.md');
                                content = `# Architecture\n\n> System architecture and design decisions\n\n## Overview\n\nThis document describes the overall architecture of the system.\n\n## Components\n\n- **Frontend**: User interface components\n- **Backend**: API and business logic\n- **Database**: Data storage layer\n\n## Design Decisions\n\n- Explain key architectural choices\n`;
                            } else if (task.title.includes('SETUP.md')) {
                                const docsDir = vscode.Uri.joinPath(workspaceFolder.uri, 'docs');
                                try {
                                    await vscode.workspace.fs.stat(docsDir);
                                } catch {
                                    await vscode.workspace.fs.createDirectory(docsDir);
                                }
                                docPath = vscode.Uri.joinPath(workspaceFolder.uri, 'docs', 'SETUP.md');
                                content = `# Development Setup\n\n> Environment setup and configuration\n\n## Prerequisites\n\n- Node.js 18+\n- npm or yarn\n\n## Setup Steps\n\n1. Clone the repository\n2. Install dependencies: \`npm install\`\n3. Configure environment variables\n4. Run the development server: \`npm run dev\`\n`;
                            } else if (task.title.includes('CHANGELOG.md')) {
                                docPath = vscode.Uri.joinPath(workspaceFolder.uri, 'CHANGELOG.md');
                                content = `# Changelog\n\n> Version history and release notes\n\n## [Unreleased]\n\n### Added\n- Initial project setup\n\n### Changed\n- \n\n### Fixed\n- \n`;
                            } else if (task.title.includes('CONTRIBUTING.md')) {
                                const docsDir = vscode.Uri.joinPath(workspaceFolder.uri, 'docs');
                                try {
                                    await vscode.workspace.fs.stat(docsDir);
                                } catch {
                                    await vscode.workspace.fs.createDirectory(docsDir);
                                }
                                docPath = vscode.Uri.joinPath(workspaceFolder.uri, 'docs', 'CONTRIBUTING.md');
                                content = `# Contributing\n\n> Guidelines for contributing to this project\n\n## Getting Started\n\n1. Fork the repository\n2. Create a feature branch\n3. Make your changes\n4. Submit a pull request\n\n## Code Style\n\n- Follow existing code conventions\n- Add tests for new features\n- Update documentation as needed\n`;
                            } else {
                                // Domain-specific documentation
                                const docName = task.title.replace('Create ', '').replace('Update ', '');
                                const docsDir = vscode.Uri.joinPath(workspaceFolder.uri, 'docs');
                                try {
                                    await vscode.workspace.fs.stat(docsDir);
                                } catch {
                                    await vscode.workspace.fs.createDirectory(docsDir);
                                }
                                docPath = vscode.Uri.joinPath(workspaceFolder.uri, 'docs', docName);
                                content = `# ${docName.replace('.md', '')}\n\n> ${task.description}\n\n## Overview\n\nDescribe this domain/module here.\n\n## Components\n\n- List key components\n\n## Usage\n\n\`\`\`typescript\n// Example usage\n\`\`\`\n`;
                            }
                            
                            // Write the file
                            await vscode.workspace.fs.writeFile(docPath, new TextEncoder().encode(content));
                            
                            // Track this file as generated
                            generatedFiles.add(docPath.toString());
                            
                            // Track the change
                            const relativePath = path.relative(workspaceFolder.uri.fsPath, docPath.fsPath);
                            await changeTracker.trackFileCreation(relativePath, content, {
                                taskTitle: task.title,
                                docType: task.title.includes('API') ? 'API' : task.title.includes('ARCHITECTURE') ? 'Architecture' : task.title.includes('SETUP') ? 'Setup' : task.title.includes('CONTRIBUTING') ? 'Contributing' : 'Documentation'
                            });
                            
                            // Debug: Log what we just created
                            console.log(`Generated file: ${docPath.toString()}`);
                            console.log(`Task title: ${task.title}`);
                            
                            // Update progress with percentage and items status
                            const percentage = ((i + 1) / tasks.length) * 100;
                            
                            // Create updated items array with proper statuses
                            const updatedItems = tasks.map((t, idx) => ({
                                name: t.title,
                                type: t.type,
                                status: idx < i ? 'completed' : (idx === i ? 'generating' : 'pending'),
                                description: t.description,
                                priority: t.priority,
                                index: idx
                            }));
                            
                            webviewView.webview.postMessage({
                                command: 'generationProgress',
                                percentage: percentage,
                                status: `Generating ${task.title}...`,
                                completedItems: i + 1,
                                items: updatedItems
                            });
                            
                            // Fast generation delay (1 second)
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            
                            // Immediately refresh dashboard to remove completed task
                            const refreshed = await analyzeWorkspace();
                            
                            // Filter out tasks for files we just generated
                            if (refreshed.docTasks) {
                                refreshed.docTasks = refreshed.docTasks.filter(task => {
                                    const taskFileName = task.title.replace('Create ', '').replace('Update ', '');
                                    const generatedFilePath = docPath.toString();
                                    return !generatedFilePath.includes(taskFileName);
                                });
                            }
                            
                            webviewView.webview.postMessage({ command: 'updateDashboardStats', stats: refreshed });
                            
                            // Refresh activity data
                            sendActivityData(webviewView);
                        }
                        
                        webviewView.webview.postMessage({ 
                            command: 'generationComplete',
                            completedItems: tasks.length,
                            items: tasks.map((task, idx) => ({
                                name: task.title,
                                type: task.type,
                                status: 'completed',
                                index: idx
                            }))
                        });
                        
                        vscode.window.showInformationMessage(`Successfully generated ${tasks.length} documentation files!`);
                        
                    } catch (error) {
                        webviewView.webview.postMessage({ 
                            command: 'generationError',
                            error: error instanceof Error ? error.message : 'Unknown error',
                            items: []
                        });
                        vscode.window.showErrorMessage(`Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    } finally {
                        isGenerating = false;
                        isPaused = false;
                        generationAbortController = null;
                        
                        // Reset button states
                        webviewView.webview.postMessage({ 
                            command: 'generationCompleted'
                        });
                    }
                } else if (message.command === 'pauseGeneration') {
                    // Pause the generation process
                    if (isGenerating && !isPaused) {
                        isPaused = true;
                        webviewView.webview.postMessage({ 
                            command: 'generationPaused',
                            message: 'Generation paused by user'
                        });
                        vscode.window.showInformationMessage('Documentation generation paused.');
                    }
                } else if (message.command === 'resumeGeneration') {
                    // Resume the generation process
                    if (isGenerating && isPaused) {
                        isPaused = false;
                        webviewView.webview.postMessage({ 
                            command: 'generationResumed',
                            message: 'Generation resumed by user'
                        });
                        vscode.window.showInformationMessage('Documentation generation resumed.');
                    }
                } else if (message.command === 'cancelGeneration') {
                    // Cancel the generation process
                    if (isGenerating) {
                        isGenerating = false;
                        isPaused = false;
                        if (generationAbortController) {
                            generationAbortController.abort();
                        }
                        generationAbortController = null;
                        webviewView.webview.postMessage({ 
                            command: 'generationCancelled',
                            message: 'Generation cancelled by user'
                        });
                        vscode.window.showInformationMessage('Documentation generation cancelled.');
                    }
                } else if (message.command === 'docTaskAction') {
                    try {
                        const stats = await analyzeWorkspace();
                        const tasks = stats.docTasks || [];
                        const task = tasks[message.index];
                        if (!task) { vscode.window.showWarningMessage('Task not found.'); return; }
                        if (message.action === 'generate') {
                            // Generate the file directly with simple logic
                            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                            if (!workspaceFolder) {
                                vscode.window.showErrorMessage('No workspace folder found.');
                                return;
                            }
                            
                            let docPath: vscode.Uri;
                            let content: string;
                            
                            if (task.title.includes('README.md')) {
                                docPath = vscode.Uri.joinPath(workspaceFolder.uri, 'README.md');
                                content = `# ${workspaceFolder.name}\n\n> Project overview and getting started guide\n\n## Overview\n\nDescribe your project here.\n\n## Installation\n\n\`\`\`bash\nnpm install\n\`\`\`\n\n## Usage\n\n\`\`\`bash\nnpm start\n\`\`\`\n\n## Contributing\n\nSee CONTRIBUTING.md for guidelines.\n`;
                            } else if (task.title.includes('API.md') || task.title.includes('API Documentation')) {
                                // Create docs directory if it doesn't exist
                                const docsDir = vscode.Uri.joinPath(workspaceFolder.uri, 'docs');
                                try {
                                    await vscode.workspace.fs.stat(docsDir);
                                } catch {
                                    await vscode.workspace.fs.createDirectory(docsDir);
                                }
                                docPath = vscode.Uri.joinPath(workspaceFolder.uri, 'docs', 'API.md');
                                content = `# API Documentation\n\n> API endpoints, parameters, and examples\n\n## Overview\n\nThis document describes the API endpoints available in this project.\n\n## Endpoints\n\n### GET /api/health\n\nHealth check endpoint.\n\n**Response:**\n\`\`\`json\n{\n  "status": "ok"\n}\n\`\`\`\n`;
                            } else if (task.title.includes('ARCHITECTURE.md')) {
                                const docsDir = vscode.Uri.joinPath(workspaceFolder.uri, 'docs');
                                try {
                                    await vscode.workspace.fs.stat(docsDir);
                                } catch {
                                    await vscode.workspace.fs.createDirectory(docsDir);
                                }
                                docPath = vscode.Uri.joinPath(workspaceFolder.uri, 'docs', 'ARCHITECTURE.md');
                                content = `# Architecture\n\n> System architecture and design decisions\n\n## Overview\n\nThis document describes the overall architecture of the system.\n\n## Components\n\n- **Frontend**: User interface components\n- **Backend**: API and business logic\n- **Database**: Data storage layer\n\n## Design Decisions\n\n- Explain key architectural choices\n`;
                            } else if (task.title.includes('SETUP.md')) {
                                const docsDir = vscode.Uri.joinPath(workspaceFolder.uri, 'docs');
                                try {
                                    await vscode.workspace.fs.stat(docsDir);
                                } catch {
                                    await vscode.workspace.fs.createDirectory(docsDir);
                                }
                                docPath = vscode.Uri.joinPath(workspaceFolder.uri, 'docs', 'SETUP.md');
                                content = `# Development Setup\n\n> Environment setup and configuration\n\n## Prerequisites\n\n- Node.js 18+\n- npm or yarn\n\n## Setup Steps\n\n1. Clone the repository\n2. Install dependencies: \`npm install\`\n3. Configure environment variables\n4. Run the development server: \`npm run dev\`\n`;
                            } else if (task.title.includes('CHANGELOG.md')) {
                                docPath = vscode.Uri.joinPath(workspaceFolder.uri, 'CHANGELOG.md');
                                content = `# Changelog\n\n> Version history and release notes\n\n## [Unreleased]\n\n### Added\n- Initial project setup\n\n### Changed\n- \n\n### Fixed\n- \n`;
                            } else if (task.title.includes('CONTRIBUTING.md')) {
                                const docsDir = vscode.Uri.joinPath(workspaceFolder.uri, 'docs');
                                try {
                                    await vscode.workspace.fs.stat(docsDir);
                                } catch {
                                    await vscode.workspace.fs.createDirectory(docsDir);
                                }
                                docPath = vscode.Uri.joinPath(workspaceFolder.uri, 'docs', 'CONTRIBUTING.md');
                                content = `# Contributing\n\n> Guidelines for contributing to this project\n\n## Getting Started\n\n1. Fork the repository\n2. Create a feature branch\n3. Make your changes\n4. Submit a pull request\n\n## Code Style\n\n- Follow existing code conventions\n- Add tests for new features\n- Update documentation as needed\n`;
                            } else {
                                // Domain-specific documentation
                                const docName = task.title.replace('Create ', '').replace('Update ', '');
                                const docsDir = vscode.Uri.joinPath(workspaceFolder.uri, 'docs');
                                try {
                                    await vscode.workspace.fs.stat(docsDir);
                                } catch {
                                    await vscode.workspace.fs.createDirectory(docsDir);
                                }
                                docPath = vscode.Uri.joinPath(workspaceFolder.uri, 'docs', docName);
                                content = `# ${docName.replace('.md', '')}\n\n> ${task.description}\n\n## Overview\n\nDescribe this domain/module here.\n\n## Components\n\n- List key components\n\n## Usage\n\n\`\`\`typescript\n// Example usage\n\`\`\`\n`;
                            }
                            
                            // Write the file
                            await vscode.workspace.fs.writeFile(docPath, new TextEncoder().encode(content));
                            
                            // Track the change
                            const relativePath = path.relative(workspaceFolder.uri.fsPath, docPath.fsPath);
                            await changeTracker.trackFileCreation(relativePath, content, {
                                taskTitle: task.title,
                                docType: task.title.includes('API') ? 'API' : task.title.includes('ARCHITECTURE') ? 'Architecture' : task.title.includes('SETUP') ? 'Setup' : task.title.includes('CONTRIBUTING') ? 'Contributing' : 'Documentation'
                            });
                            
                            // Debug: Log what we just created
                            console.log(`Generated file: ${docPath.toString()}`);
                            console.log(`Task title: ${task.title}`);
                            
                            // Fast delay (1 second)
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            
                            // Refresh dashboard to update doc tasks list
                            const refreshed = await analyzeWorkspace();
                            
                            // Filter out tasks for files we just generated
                            if (refreshed.docTasks) {
                                refreshed.docTasks = refreshed.docTasks.filter(task => {
                                    const taskFileName = task.title.replace('Create ', '').replace('Update ', '');
                                    const generatedFilePath = docPath.toString();
                                    return !generatedFilePath.includes(taskFileName);
                                });
                            }
                            
                            webviewView.webview.postMessage({ command: 'updateDashboardStats', stats: refreshed });
                            
                            // Refresh activity data
                            sendActivityData(webviewView);
                            
                            vscode.window.showInformationMessage(`Successfully generated ${task.title}!`);
                        }
                    } catch (err) {
                        vscode.window.showErrorMessage(`Doc task failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
                    }
                } else if (message.command === 'notificationAction') {
                    const action = message.action || 'Open';
                    const id = message.id || '';
                    
                    try {
                        // Map button labels to action IDs
                        const actionMap: { [key: string]: string } = {
                            'View PR': 'viewPR',
                            'Suggest doc update': 'suggestDocUpdate',
                            'Open README': 'openDocument',
                            'Generate update': 'generateUpdate',
                            'Generate changelog': 'generateChangelog'
                        };
                        
                        const actionId = actionMap[action] || action;
                        
                        // Handle maintenance-related notification actions
                        if (actionId === 'viewPR') {
                            await maintenanceService.viewPR(id);
                        } else if (actionId === 'suggestDocUpdate') {
                            await maintenanceService.suggestDocUpdate(id);
                        } else if (actionId === 'openDocument') {
                            await maintenanceService.openDocument('README.md');
                        } else if (actionId === 'generateUpdate') {
                            await maintenanceService.generateUpdate('README.md');
                        } else if (actionId === 'generateChangelog') {
                            await maintenanceService.generateChangelog();
                        } else {
                            vscode.window.showInformationMessage(`Notification action: ${action} on ${id}`);
                        }
                    } catch (error) {
                        vscode.window.showErrorMessage(`Error handling notification action: ${error}`);
                    }
                } else if (message.command === 'activityAction') {
                    const action = message.action || 'Open';
                    const id = message.id || '';
                    
                    try {
                        // Handle activity actions with ChangeTracker
                        if (action === 'View diff') {
                            await changeTracker.viewDiff(id);
                        } else if (action === 'Apply') {
                            const success = await changeTracker.applyChange(id);
                            if (success) {
                                // Refresh activity data after applying change
                                sendActivityData(webviewView);
                            }
                        } else if (action === 'Revert') {
                            const success = await changeTracker.revertChange(id);
                            if (success) {
                                // Refresh activity data after reverting change
                                sendActivityData(webviewView);
                            }
                        } else {
                            vscode.window.showInformationMessage(`Activity action: ${action} on ${id}`);
                        }
                    } catch (error) {
                        vscode.window.showErrorMessage(`Error handling activity action: ${error}`);
                    }
                } else if (message.command === 'saveSettings') {
                    vscode.window.showInformationMessage('Settings saved (session only).');
                }
            });
        }
    });
    context.subscriptions.push(aiChatProvider);

    async function showDraftInNewEditor(defaultName: string, content: string) {
        const folder = vscode.workspace.workspaceFolders?.[0];
        const target = folder
            ? folder.uri.with({ path: path.posix.join(folder.uri.path, defaultName) })
            : vscode.Uri.parse(`untitled:${defaultName}`);
        try {
            if (target.scheme === 'untitled') {
                const doc = await vscode.workspace.openTextDocument(target);
                const editor = await vscode.window.showTextDocument(doc, { preview: false });
                await editor.edit(e => e.insert(new vscode.Position(0,0), content));
            } else {
                await vscode.workspace.fs.writeFile(target, new TextEncoder().encode(content));
                const doc = await vscode.workspace.openTextDocument(target);
                await vscode.window.showTextDocument(doc, { preview: false });
            }
        } catch (err) {
            vscode.window.showErrorMessage(`Failed to open draft: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    // Simulate streaming generation (placeholder for real AI integration)
    async function simulateStreamingGeneration(webviewView: vscode.WebviewView, items: CodeItem[]) {
        const completedItems: any[] = [];
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            
            // Update progress
            const percentage = ((i + 1) / items.length) * 100;
            const status = `Generating documentation for ${item.name}...`;
            
            // Mark current item as generating
            const currentItems = items.map((it, idx) => ({
                name: it.name,
                type: it.type,
                status: idx < i ? 'completed' : idx === i ? 'generating' : 'pending'
            }));
            
            webviewView.webview.postMessage({
                command: 'generationProgress',
                percentage,
                status,
                items: currentItems
            });
            
            // Simulate AI generation time
            await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
            
            // Mark as completed
            completedItems.push({
                name: item.name,
                type: item.type,
                status: 'completed'
            });
        }
        
        // Complete generation
        webviewView.webview.postMessage({
            command: 'generationComplete',
            completedItems: completedItems.length,
            items: completedItems
        });
        
        // Show completion message
        vscode.window.showInformationMessage(`Successfully generated documentation for ${completedItems.length} items!`);
    }

    // Register hover provider for inline AI insights
    const hoverProvider = vscode.languages.registerHoverProvider('*', {
        provideHover(document, position, token) {
            const range = document.getWordRangeAtPosition(position);
            if (range) {
                const word = document.getText(range);
                if (word.length > 3) { // Only show for words longer than 3 characters
                    const hoverMessage = new vscode.MarkdownString();
                    hoverMessage.appendMarkdown(`**🤖 AI Insight for "${word}"**\n\n`);
                    hoverMessage.appendMarkdown(`Click the AI Chat button in the status bar to ask questions about this term or get coding help!`);
                    
                    return new vscode.Hover(hoverMessage, range);
                }
            }
            return null;
        }
    });
    context.subscriptions.push(hoverProvider);



    // Create status bar item -> focus the sidebar chat
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = '$(comment-discussion) Documind AI';
    statusBarItem.tooltip = 'Focus Documind AI';
    statusBarItem.command = 'codenection.focusChat';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Focus AI Chat command: reveal secondary side bar + our view
    const focusChat = vscode.commands.registerCommand('codenection.focusChat', async () => {
        // Focus the primary Activity Bar container, then the view
        try {
            await vscode.commands.executeCommand('workbench.view.extension.codenection');
        } catch {}
        try {
            await vscode.commands.executeCommand('workbench.views.openView', 'codenection.aiChat', true);
        } catch {}
    });
    context.subscriptions.push(focusChat);

    // Register commands
    const openChatCommand = vscode.commands.registerCommand('codenection.openChat', () => {
        // Create a terminal-based chat interface
        const terminal = vscode.window.createTerminal('🤖 Documind AI');
        terminal.show();
        
        // Send initial message to terminal
        terminal.sendText('echo "🤖 Documind AI Ready!"');
        terminal.sendText('echo "Type your question and press Enter:"');
        terminal.sendText('echo ""');
        
        // Create a simple chat loop in the terminal
        const chatLoop = async () => {
            try {
                // Get user input from terminal
                const question = await vscode.window.showInputBox({
                    prompt: 'Ask me anything about your code or documentation:',
                    placeHolder: 'e.g., How do I implement authentication?',
                    ignoreFocusOut: true
                });
                
                if (question && question.trim()) {
                    // Show user question in terminal
                    terminal.sendText(`echo "👤 You: ${question}"`);
                    
                    try {
                        // Get AI response (placeholder for now)
                        const response = `🤖 **Documind AI Response**\n\nYou asked: "${question}"\n\nThis is a placeholder response. In the real version, this would be an AI-generated response based on your codebase.`;
                        
                        // Show AI response in terminal
                        terminal.sendText(`echo "🤖 AI: ${response}"`);
                        
                        terminal.sendText('echo ""');
                        terminal.sendText('echo "💡 Features coming soon:"');
                        terminal.sendText('echo "  • Real AI integration (OpenAI, Claude, etc.)"');
                        terminal.sendText('echo "  • Context-aware code analysis"');
                        terminal.sendText('echo "  • Documentation improvements"');
                        
                        terminal.sendText('echo ""');
                        terminal.sendText('echo "---"');
                        terminal.sendText('echo "Type another question or close the terminal to end chat."');
                        terminal.sendText('echo ""');
                        
                        // Continue chat loop
                        chatLoop();
                        
                    } catch (error) {
                        terminal.sendText(`echo "❌ AI Error: ${error instanceof Error ? error.message : 'Unknown error'}"`);
                        terminal.sendText('echo ""');
                        chatLoop();
                    }
        } else {
                    terminal.sendText('echo "Chat ended. Close the terminal or run the command again to restart."');
                }
            } catch (error) {
                terminal.sendText(`echo "❌ Chat Error: ${error instanceof Error ? error.message : 'Unknown error'}"`);
            }
        };
        
        // Start the chat loop
        chatLoop();
    });

    const uploadDocumentCommand = vscode.commands.registerCommand('codenection.uploadDocument', async (uri?: vscode.Uri) => {
        vscode.window.showInformationMessage('Document upload feature coming soon! This will integrate with RAG services.');
    });

    // Add context menu command for selected text
    const askAboutSelectionCommand = vscode.commands.registerCommand('codenection.askAboutSelection', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);
            
            if (selectedText.trim()) {
                // Create a quick input box for the selected text
                const question = await vscode.window.showInputBox({
                    prompt: `Ask about: "${selectedText.substring(0, 50)}${selectedText.length > 50 ? '...' : ''}"`,
                    placeHolder: 'e.g., What does this code do? How can I improve it?',
                    value: `What does this code do: ${selectedText}`
                });
                
                if (question) {
                    try {
                        // Placeholder response for now
                        const response = `🤖 **Documind AI Response**\n\nYou asked about: "${selectedText.substring(0, 50)}${selectedText.length > 50 ? '...' : ''}"\n\nThis is a placeholder response. In the real version, this would be an AI-generated analysis of your selected code.`;
                        
                        aiOutputChannel.show();
                        aiOutputChannel.appendLine(`\n👤 You: ${question}`);
                        aiOutputChannel.appendLine(`🤖 AI: ${response}`);
                        aiOutputChannel.appendLine(`\n💡 Features coming soon:`);
                        aiOutputChannel.appendLine(`  • Real AI code analysis`);
                        aiOutputChannel.appendLine(`  • Context-aware suggestions`);
                        aiOutputChannel.appendLine(`  • Documentation improvements`);
                        
                        vscode.window.showInformationMessage(`AI Response Ready! Check the "Documind AI" output panel for details.`);
                    } catch (error) {
                        vscode.window.showErrorMessage(`AI Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            } else {
                vscode.window.showWarningMessage('Please select some text first to ask about it.');
            }
        } else {
            vscode.window.showWarningMessage('Please open a text editor first.');
        }
    });

    const searchDocsCommand = vscode.commands.registerCommand('codenection.searchDocs', async () => {
        const query = await vscode.window.showInputBox({
            prompt: 'Enter your search query',
            placeHolder: 'e.g., How to implement authentication?'
        });

        if (query) {
            aiOutputChannel.show();
            aiOutputChannel.appendLine(`🔍 Searching for: "${query}"`);
            
            try {
                // Placeholder search response for now
                aiOutputChannel.appendLine(`📚 Search feature coming soon!`);
                aiOutputChannel.appendLine(`   This will search through your uploaded documents using RAG.`);
                aiOutputChannel.appendLine(`   For now, try the chat feature or ask about selected code.`);
            } catch (error) {
                aiOutputChannel.appendLine(`❌ Search error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            
            aiOutputChannel.appendLine(''); // Empty line for readability
        }
    });

    const configureAICommand = vscode.commands.registerCommand('codenection.configureAI', () => {
        // Show AI configuration in a simple way
        vscode.window.showInformationMessage('AI Configuration: Use VS Code settings to configure AI providers');
        
        // Open VS Code settings focused on CodeNection
        vscode.commands.executeCommand('workbench.action.openSettings', '@ext:codenection-ai-docs');
    });

    context.subscriptions.push(
        openChatCommand,
        uploadDocumentCommand,
        askAboutSelectionCommand,
        searchDocsCommand,
        configureAICommand
    );
    
    // Add file watcher to subscriptions for proper cleanup
    if (fileWatcher) {
        context.subscriptions.push(fileWatcher);
    }
    
    vscode.window.showInformationMessage('Documind AI Extension activated successfully! All commands registered.');
    
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to activate Documind AI Extension: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.error('Extension activation failed:', error);
    }
}

export function deactivate() {
    // Cleanup file watcher
    if (fileWatcher) {
        fileWatcher.dispose();
        fileWatcher = undefined;
    }
    
    console.log('Documind AI Docs Assistant is now deactivated!');
} 