import * as path from 'path';
import * as vscode from 'vscode';
import { DocsServiceClient } from './DocsServiceClient';
import { ProjectStructure } from './WorkspaceAnalyzer';

export interface DocumentationPlan {
    files: Array<{
        name: string;
        path: string;
        type: 'readme' | 'api' | 'architecture' | 'setup' | 'changelog' | 'contributing' | 'domain';
        priority: 'high' | 'medium' | 'low';
        description: string;
        content: string;
    }>;
    totalFiles: number;
    estimatedTime: string;
}

export class DocumentationGenerator {
    private docsServiceClient: DocsServiceClient;

    constructor() {
        this.docsServiceClient = new DocsServiceClient();
    }

    async generateDocumentationPlan(projectStructure: ProjectStructure): Promise<DocumentationPlan> {
        const files = [];
        
        // 1. README.md - Always high priority
        files.push({
            name: 'README.md',
            path: 'README.md',
            type: 'readme',
            priority: 'high',
            description: 'Project overview, quick start guide, and essential information',
            content: await this.generateReadme(projectStructure)
        });

        // 2. API.md - High priority if there are API endpoints
        const hasApiEndpoints = projectStructure.domains.some(d => d.endpoints.length > 0);
        if (hasApiEndpoints) {
            files.push({
                name: 'API.md',
                path: 'docs/API.md',
                type: 'api',
                priority: 'high',
                description: 'Comprehensive API documentation with endpoints and examples',
                content: await this.generateApiDocs(projectStructure)
            });
        }

        // 3. ARCHITECTURE.md - Medium priority for complex projects
        if (projectStructure.domains.length > 3 || projectStructure.architecture !== 'Monolithic') {
            files.push({
                name: 'ARCHITECTURE.md',
                path: 'docs/ARCHITECTURE.md',
                type: 'architecture',
                priority: 'medium',
                description: 'System architecture, design patterns, and component relationships',
                content: await this.generateArchitectureDocs(projectStructure)
            });
        }

        // 4. SETUP.md - High priority for projects with setup requirements
        if (projectStructure.hasDatabase || projectStructure.hasBackend) {
            files.push({
                name: 'SETUP.md',
                path: 'docs/SETUP.md',
                type: 'setup',
                priority: 'high',
                description: 'Installation, configuration, and development setup guide',
                content: await this.generateSetupDocs(projectStructure)
            });
        }

        // 5. CHANGELOG.md - Medium priority
        files.push({
            name: 'CHANGELOG.md',
            path: 'CHANGELOG.md',
            type: 'changelog',
            priority: 'medium',
            description: 'Version history and release notes',
            content: await this.generateChangelog(projectStructure)
        });

        // 6. CONTRIBUTING.md - Low priority but good to have
        if (projectStructure.hasTests) {
            files.push({
                name: 'CONTRIBUTING.md',
                path: 'docs/CONTRIBUTING.md',
                type: 'contributing',
                priority: 'low',
                description: 'Development guidelines, coding standards, and contribution process',
                content: await this.generateContributingDocs(projectStructure)
            });
        }

        // 7. Domain-specific documentation - Generate for high-priority domains
        for (const domain of projectStructure.domains) {
            if (domain.priority === 'high') {
                const domainDocName = `${domain.name.toUpperCase()}.md`;
                files.push({
                    name: domainDocName,
                    path: `docs/${domainDocName}`,
                    type: 'domain',
                    priority: 'medium',
                    description: `Documentation for ${domain.name} domain with ${domain.files.length} files`,
                    content: await this.generateDomainDoc(domain)
                });
            }
        }

        const totalFiles = files.length;
        const estimatedTime = this.calculateEstimatedTime(files);

        return {
            files: files as Array<{
                name: string;
                path: string;
                type: 'readme' | 'api' | 'architecture' | 'setup' | 'changelog' | 'contributing' | 'domain';
                priority: 'high' | 'medium' | 'low';
                description: string;
                content: string;
            }>,
            totalFiles,
            estimatedTime
        };
    }

    private async generateReadme(projectStructure: ProjectStructure): Promise<string> {
        const projectName = this.getProjectName();
        const framework = projectStructure.framework;
        const architecture = projectStructure.architecture;
        
        let content = `# ${projectName}\n\n`;
        
        // Project description
        content += `A ${framework} application built with ${architecture} architecture.\n\n`;
        
        // Features
        content += `## Features\n\n`;
        if (projectStructure.hasFrontend) content += `- **Frontend**: Modern web interface\n`;
        if (projectStructure.hasBackend) content += `- **Backend**: RESTful API services\n`;
        if (projectStructure.hasDatabase) content += `- **Database**: Data persistence layer\n`;
        if (projectStructure.hasTests) content += `- **Testing**: Comprehensive test coverage\n`;
        content += `\n`;
        
        // Quick start
        content += `## Quick Start\n\n`;
        content += `\`\`\`bash\n`;
        content += `# Install dependencies\n`;
        content += `npm install\n\n`;
        content += `# Start development server\n`;
        content += `npm run dev\n`;
        content += `\`\`\`\n\n`;
        
        // Project structure
        content += `## Project Structure\n\n`;
        content += `\`\`\`\n`;
        content += `${projectName}/\n`;
        if (projectStructure.hasFrontend) content += `├── src/           # Frontend source code\n`;
        if (projectStructure.hasBackend) content += `├── api/           # Backend API routes\n`;
        if (projectStructure.hasDatabase) content += `├── models/        # Database models\n`;
        if (projectStructure.hasTests) content += `├── tests/         # Test files\n`;
        content += `├── docs/          # Documentation\n`;
        content += `└── README.md      # This file\n`;
        content += `\`\`\`\n\n`;
        
        // Domains
        if (projectStructure.domains.length > 0) {
            content += `## Core Domains\n\n`;
            for (const domain of projectStructure.domains.slice(0, 5)) {
                content += `- **${domain.name}**: ${domain.description}\n`;
            }
            content += `\n`;
        }
        
        // Documentation
        content += `## Documentation\n\n`;
        content += `- [API Documentation](docs/API.md) - Complete API reference\n`;
        if (projectStructure.domains.length > 3) {
            content += `- [Architecture Guide](docs/ARCHITECTURE.md) - System design overview\n`;
        }
        if (projectStructure.hasDatabase || projectStructure.hasBackend) {
            content += `- [Setup Guide](docs/SETUP.md) - Installation and configuration\n`;
        }
        content += `- [Changelog](CHANGELOG.md) - Version history\n`;
        content += `\n`;
        
        // License
        content += `## License\n\n`;
        content += `This project is licensed under the MIT License.\n`;
        
        return content;
    }

    private async generateApiDocs(projectStructure: ProjectStructure): Promise<string> {
        let content = `# API Documentation\n\n`;
        content += `This document provides comprehensive documentation for all API endpoints.\n\n`;
        
        // Group endpoints by domain
        const apiDomains = projectStructure.domains.filter(d => d.endpoints.length > 0);
        
        for (const domain of apiDomains) {
            content += `## ${domain.name}\n\n`;
            content += `${domain.description}\n\n`;
            
            if (domain.endpoints.length > 0) {
                content += `### Endpoints\n\n`;
                for (const endpoint of domain.endpoints) {
                    content += `#### ${endpoint.name}\n\n`;
                    content += `\`\`\`\n${endpoint.signature}\n\`\`\`\n\n`;
                    content += `**File**: \`${endpoint.filePath}\`\n`;
                    content += `**Line**: ${endpoint.lineNumber}\n\n`;
                }
            }
            
            if (domain.classes.length > 0) {
                content += `### Classes\n\n`;
                for (const cls of domain.classes) {
                    content += `#### ${cls.name}\n\n`;
                    content += `\`\`\`\n${cls.signature}\n\`\`\`\n\n`;
                }
            }
            
            content += `---\n\n`;
        }
        
        // Authentication
        content += `## Authentication\n\n`;
        content += `All API endpoints require authentication unless otherwise specified.\n\n`;
        content += `### Headers\n\n`;
        content += `\`\`\`\n`;
        content += `Authorization: Bearer <your-token>\n`;
        content += `Content-Type: application/json\n`;
        content += `\`\`\`\n\n`;
        
        // Error handling
        content += `## Error Handling\n\n`;
        content += `The API uses standard HTTP status codes:\n\n`;
        content += `- \`200\` - Success\n`;
        content += `- \`400\` - Bad Request\n`;
        content += `- \`401\` - Unauthorized\n`;
        content += `- \`404\` - Not Found\n`;
        content += `- \`500\` - Internal Server Error\n\n`;
        
        return content;
    }

    private async generateArchitectureDocs(projectStructure: ProjectStructure): Promise<string> {
        let content = `# Architecture Documentation\n\n`;
        content += `This document describes the system architecture, design patterns, and component relationships.\n\n`;
        
        // Overview
        content += `## System Overview\n\n`;
        content += `The application follows a **${projectStructure.architecture}** architecture pattern using **${projectStructure.framework}** framework.\n\n`;
        
        // Architecture diagram (text-based)
        content += `## Architecture Diagram\n\n`;
        content += `\`\`\`\n`;
        if (projectStructure.hasFrontend && projectStructure.hasBackend) {
            content += `┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐\n`;
            content += `│   Frontend      │    │   Backend       │    │   Database      │\n`;
            content += `│   (${projectStructure.framework})    │◄──►│   (API Routes)  │◄──►│   (Data Layer)  │\n`;
            content += `└─────────────────┘    └─────────────────┘    └─────────────────┘\n`;
        } else if (projectStructure.hasBackend) {
            content += `┌─────────────────┐    ┌─────────────────┐\n`;
            content += `│   Backend       │    │   Database      │\n`;
            content += `│   (${projectStructure.framework})    │◄──►│   (Data Layer)  │\n`;
            content += `└─────────────────┘    └─────────────────┘\n`;
        } else {
            content += `┌─────────────────┐\n`;
            content += `│   Frontend      │\n`;
            content += `│   (${projectStructure.framework})    │\n`;
            content += `└─────────────────┘\n`;
        }
        content += `\`\`\`\n\n`;
        
        // Domains
        content += `## Domain Architecture\n\n`;
        for (const domain of projectStructure.domains) {
            content += `### ${domain.name}\n\n`;
            content += `${domain.description}\n\n`;
            content += `**Type**: ${domain.type}\n`;
            content += `**Priority**: ${domain.priority}\n`;
            content += `**Files**: ${domain.files.length}\n`;
            content += `**Endpoints**: ${domain.endpoints.length}\n`;
            content += `**Classes**: ${domain.classes.length}\n`;
            content += `**Functions**: ${domain.functions.length}\n\n`;
        }
        
        // Design patterns
        content += `## Design Patterns\n\n`;
        if (projectStructure.architecture === 'MVC') {
            content += `- **Model-View-Controller (MVC)**: Separation of concerns between data, presentation, and business logic\n`;
        } else if (projectStructure.architecture === 'Microservices') {
            content += `- **Microservices**: Distributed system with independent, scalable services\n`;
        } else if (projectStructure.architecture === 'Layered Architecture') {
            content += `- **Layered Architecture**: Organized in horizontal layers with clear separation\n`;
        }
        content += `\n`;
        
        // Technology stack
        content += `## Technology Stack\n\n`;
        content += `- **Framework**: ${projectStructure.framework}\n`;
        content += `- **Architecture**: ${projectStructure.architecture}\n`;
        if (projectStructure.hasFrontend) content += `- **Frontend**: Modern web technologies\n`;
        if (projectStructure.hasBackend) content += `- **Backend**: RESTful API services\n`;
        if (projectStructure.hasDatabase) content += `- **Database**: Data persistence layer\n`;
        if (projectStructure.hasTests) content += `- **Testing**: Comprehensive test suite\n`;
        content += `\n`;
        
        return content;
    }

    private async generateSetupDocs(projectStructure: ProjectStructure): Promise<string> {
        let content = `# Setup Guide\n\n`;
        content += `This guide will help you set up the development environment and get the application running.\n\n`;
        
        // Prerequisites
        content += `## Prerequisites\n\n`;
        content += `- Node.js (v16 or higher)\n`;
        content += `- npm or yarn package manager\n`;
        if (projectStructure.hasDatabase) {
            content += `- Database server (PostgreSQL/MySQL/MongoDB)\n`;
        }
        content += `\n`;
        
        // Installation
        content += `## Installation\n\n`;
        content += `1. Clone the repository:\n`;
        content += `\`\`\`bash\n`;
        content += `git clone <repository-url>\n`;
        content += `cd ${this.getProjectName()}\n`;
        content += `\`\`\`\n\n`;
        
        content += `2. Install dependencies:\n`;
        content += `\`\`\`bash\n`;
        content += `npm install\n`;
        content += `\`\`\`\n\n`;
        
        // Configuration
        content += `## Configuration\n\n`;
        content += `1. Copy environment variables:\n`;
        content += `\`\`\`bash\n`;
        content += `cp .env.example .env\n`;
        content += `\`\`\`\n\n`;
        
        content += `2. Update configuration values in \`.env\`:\n`;
        content += `\`\`\`\n`;
        if (projectStructure.hasDatabase) {
            content += `DATABASE_URL=postgresql://user:password@localhost:5432/dbname\n`;
        }
        content += `PORT=3000\n`;
        content += `NODE_ENV=development\n`;
        content += `\`\`\`\n\n`;
        
        // Database setup
        if (projectStructure.hasDatabase) {
            content += `## Database Setup\n\n`;
            content += `1. Create database:\n`;
            content += `\`\`\`bash\n`;
            content += `createdb ${this.getProjectName().toLowerCase()}_dev\n`;
            content += `\`\`\`\n\n`;
            
            content += `2. Run migrations:\n`;
            content += `\`\`\`bash\n`;
            content += `npm run migrate\n`;
            content += `\`\`\`\n\n`;
        }
        
        // Development
        content += `## Development\n\n`;
        content += `Start the development server:\n`;
        content += `\`\`\`bash\n`;
        content += `npm run dev\n`;
        content += `\`\`\`\n\n`;
        
        content += `The application will be available at \`http://localhost:3000\`\n\n`;
        
        // Testing
        if (projectStructure.hasTests) {
            content += `## Testing\n\n`;
            content += `Run tests:\n`;
            content += `\`\`\`bash\n`;
            content += `npm test\n`;
            content += `\`\`\`\n\n`;
        }
        
        return content;
    }

    private async generateChangelog(projectStructure: ProjectStructure): Promise<string> {
        let content = `# Changelog\n\n`;
        content += `All notable changes to this project will be documented in this file.\n\n`;
        content += `The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),\n`;
        content += `and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).\n\n`;
        
        // Current version
        content += `## [Unreleased]\n\n`;
        content += `### Added\n`;
        content += `- Initial project setup\n`;
        content += `- Core domain structure\n`;
        for (const domain of projectStructure.domains) {
            content += `- ${domain.name} domain implementation\n`;
        }
        content += `\n`;
        
        content += `### Changed\n`;
        content += `- N/A\n\n`;
        
        content += `### Deprecated\n`;
        content += `- N/A\n\n`;
        
        content += `### Removed\n`;
        content += `- N/A\n\n`;
        
        content += `### Fixed\n`;
        content += `- N/A\n\n`;
        
        content += `### Security\n`;
        content += `- N/A\n\n`;
        
        return content;
    }

    private async generateContributingDocs(projectStructure: ProjectStructure): Promise<string> {
        let content = `# Contributing Guide\n\n`;
        content += `Thank you for your interest in contributing to this project! This guide will help you get started.\n\n`;
        
        // Getting started
        content += `## Getting Started\n\n`;
        content += `1. Fork the repository\n`;
        content += `2. Create a feature branch: \`git checkout -b feature/amazing-feature\`\n`;
        content += `3. Make your changes\n`;
        content += `4. Run tests: \`npm test\`\n`;
        content += `5. Commit your changes: \`git commit -m 'Add amazing feature'\`\n`;
        content += `6. Push to the branch: \`git push origin feature/amazing-feature\`\n`;
        content += `7. Open a Pull Request\n\n`;
        
        // Code style
        content += `## Code Style\n\n`;
        content += `We follow these coding standards:\n\n`;
        content += `- Use meaningful variable and function names\n`;
        content += `- Add comments for complex logic\n`;
        content += `- Follow the existing code structure\n`;
        content += `- Write tests for new features\n\n`;
        
        // Testing
        if (projectStructure.hasTests) {
            content += `## Testing\n\n`;
            content += `- Write unit tests for new functions\n`;
            content += `- Write integration tests for new features\n`;
            content += `- Ensure all tests pass before submitting PR\n`;
            content += `- Aim for high test coverage\n\n`;
        }
        
        // Pull requests
        content += `## Pull Requests\n\n`;
        content += `- Provide a clear description of changes\n`;
        content += `- Link to any related issues\n`;
        content += `- Ensure CI/CD checks pass\n`;
        content += `- Request review from maintainers\n\n`;
        
        return content;
    }

    private async generateDomainDoc(domain: any): Promise<string> {
        let content = `# ${domain.name.toUpperCase()}\n\n`;
        content += `> ${domain.description}\n\n`;
        
        // Overview
        content += `## Overview\n\n`;
        content += `This module handles ${domain.name.toLowerCase()} functionality in the application.\n\n`;
        
        // Components
        if (domain.classes && domain.classes.length > 0) {
            content += `## Classes\n\n`;
            for (const cls of domain.classes) {
                content += `### ${cls.name}\n\n`;
                content += `\`\`\`typescript\n${cls.signature}\n\`\`\`\n\n`;
                if (cls.description) {
                    content += `${cls.description}\n\n`;
                }
            }
        }
        
        // Functions
        if (domain.functions && domain.functions.length > 0) {
            content += `## Functions\n\n`;
            for (const func of domain.functions) {
                content += `### ${func.name}\n\n`;
                content += `\`\`\`typescript\n${func.signature}\n\`\`\`\n\n`;
                if (func.description) {
                    content += `${func.description}\n\n`;
                }
            }
        }
        
        // API Endpoints
        if (domain.endpoints && domain.endpoints.length > 0) {
            content += `## API Endpoints\n\n`;
            for (const endpoint of domain.endpoints) {
                content += `### ${endpoint.name}\n\n`;
                content += `\`\`\`\n${endpoint.signature}\n\`\`\`\n\n`;
                content += `**File**: \`${endpoint.filePath}\`\n`;
                content += `**Line**: ${endpoint.lineNumber}\n\n`;
            }
        }
        
        // Files
        if (domain.files && domain.files.length > 0) {
            content += `## Files\n\n`;
            for (const file of domain.files) {
                content += `- \`${file}\`\n`;
            }
            content += `\n`;
        }
        
        // Usage Examples
        content += `## Usage Examples\n\n`;
        content += `\`\`\`typescript\n`;
        content += `// Example usage of ${domain.name.toLowerCase()} functionality\n`;
        content += `// Add specific examples based on the domain\n`;
        content += `\`\`\`\n\n`;
        
        return content;
    }

    private getProjectName(): string {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            return path.basename(workspaceFolders[0].uri.fsPath);
        }
        return 'Project';
    }

    private calculateEstimatedTime(files: Array<{priority: string}>): string {
        const highPriority = files.filter(f => f.priority === 'high').length;
        const mediumPriority = files.filter(f => f.priority === 'medium').length;
        const lowPriority = files.filter(f => f.priority === 'low').length;
        
        const totalMinutes = (highPriority * 5) + (mediumPriority * 3) + (lowPriority * 2);
        
        if (totalMinutes < 60) {
            return `${totalMinutes} minutes`;
        } else {
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
        }
    }

    async createDocumentationFiles(plan: DocumentationPlan): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('No workspace folder found');
        }

        const workspaceFolder = workspaceFolders[0];
        
        for (const file of plan.files) {
            const filePath = path.join(workspaceFolder.uri.fsPath, file.path);
            const fileUri = vscode.Uri.file(filePath);
            
            // Create directory if it doesn't exist
            const dir = path.dirname(filePath);
            await vscode.workspace.fs.createDirectory(vscode.Uri.file(dir));
            
            // Create file
            const content = new TextEncoder().encode(file.content);
            await vscode.workspace.fs.writeFile(fileUri, content);
            
            // Open file in editor
            const document = await vscode.workspace.openTextDocument(fileUri);
            await vscode.window.showTextDocument(document);
        }
    }
}
