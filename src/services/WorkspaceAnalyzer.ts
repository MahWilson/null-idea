import * as path from 'path';
import * as vscode from 'vscode';

export interface CodeItem {
    type: 'function' | 'class' | 'interface' | 'api' | 'config' | 'component';
    name: string;
    filePath: string;
    lineNumber: number;
    signature?: string;
    description?: string;
    parameters?: Array<{name: string, type: string, description?: string}>;
    returnType?: string;
    priority: 'high' | 'medium' | 'low';
    hasDocumentation: boolean;
    suggestedDocPath: string;
}

export interface ProjectDomain {
    name: string;
    type: 'api' | 'service' | 'component' | 'utility' | 'config';
    files: string[];
    endpoints: CodeItem[];
    classes: CodeItem[];
    functions: CodeItem[];
    description: string;
    priority: 'high' | 'medium' | 'low';
}

export interface ProjectStructure {
    framework: string;
    architecture: string;
    hasFrontend: boolean;
    hasBackend: boolean;
    hasDatabase: boolean;
    hasTests: boolean;
    domains: ProjectDomain[];
    totalFiles: number;
    codeFiles: number;
    docFiles: number;
    coverage: number;
}

export interface WorkspaceAnalysis {
    projectStructure: ProjectStructure;
    missingDocs: CodeItem[];
    byPriority: {
        high: CodeItem[];
        medium: CodeItem[];
        low: CodeItem[];
    };
    byType: {
        functions: CodeItem[];
        classes: CodeItem[];
        interfaces: CodeItem[];
        apis: CodeItem[];
        configs: CodeItem[];
        components: CodeItem[];
    };
    fileTypes: { [key: string]: number };
    docTasks: { type: 'missing' | 'outdated'; title: string; description: string; priority: 'high' | 'medium' | 'low'; suggestedAction: string }[];
    totalFiles: number;
    docFiles: number;
    codeFiles: number;
    docCoverage: number;
}

export class WorkspaceAnalyzer {
    private readonly codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs', '.cs', '.php', '.rb', '.swift', '.kt'];
    private readonly docExtensions = ['.md', '.txt', '.rst', '.adoc'];

    async analyzeWorkspace(): Promise<WorkspaceAnalysis> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return this.getEmptyAnalysis();
        }

        const workspaceFolder = workspaceFolders[0];
        const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**');
        
        // Analyze project structure
        const projectStructure = await this.analyzeProjectStructure(files);
        
        // Analyze code files for documentation gaps
        const missingDocs: CodeItem[] = [];
        for (const file of files) {
            const ext = path.extname(file.path).toLowerCase();
            if (this.codeExtensions.includes(ext)) {
                const codeItems = await this.analyzeCodeFile(file);
                missingDocs.push(...codeItems);
            }
        }

        // Categorize by priority and type
        const byPriority = this.categorizeByPriority(missingDocs);
        const byType = this.categorizeByType(missingDocs);

        // Also include file types and doc tasks for compatibility
        const fileTypes: { [key: string]: number } = {};
        const docTasks: { type: 'missing' | 'outdated'; title: string; description: string; priority: 'high' | 'medium' | 'low'; suggestedAction: string }[] = [];
        
        for (const file of files) {
            const ext = path.extname(file.path).toLowerCase().substring(1);
            if (ext) {
                fileTypes[ext] = (fileTypes[ext] || 0) + 1;
            }
        }
        
        // Generate industry-standard documentation tasks
        await this.generateDocumentationTasks(files, docTasks);

        return {
            projectStructure,
            missingDocs,
            byPriority,
            byType,
            fileTypes,
            docTasks,
            totalFiles: files.length,
            docFiles: files.filter(f => this.docExtensions.includes(path.extname(f.path).toLowerCase())).length,
            codeFiles: files.filter(f => this.codeExtensions.includes(path.extname(f.path).toLowerCase())).length,
            docCoverage: files.length > 0 ? Math.round((files.filter(f => this.docExtensions.includes(path.extname(f.path).toLowerCase())).length / files.length) * 100) : 0
        };
    }

    private async analyzeCodeFile(file: vscode.Uri): Promise<CodeItem[]> {
        try {
            const content = await vscode.workspace.fs.readFile(file);
            const text = content.toString();
            const ext = path.extname(file.path).toLowerCase();
            const relativePath = vscode.workspace.asRelativePath(file);
            
            const items: CodeItem[] = [];
            const lines = text.split('\n');

            // Simple regex-based parsing (will be enhanced with AI later)
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const lineNumber = i + 1;

                // Function detection
                const functionMatch = this.detectFunction(line, ext);
                if (functionMatch) {
                    items.push({
                        type: 'function',
                        name: functionMatch.name,
                        filePath: file.path,
                        lineNumber,
                        signature: functionMatch.signature,
                        priority: this.determinePriority(functionMatch.name, 'function'),
                        hasDocumentation: this.hasDocumentation(lines, i),
                        suggestedDocPath: this.getSuggestedDocPath(file.path, functionMatch.name)
                    });
                }

                // Class detection
                const classMatch = this.detectClass(line, ext);
                if (classMatch) {
                    items.push({
                        type: 'class',
                        name: classMatch.name,
                        filePath: file.path,
                        lineNumber,
                        signature: classMatch.signature,
                        priority: this.determinePriority(classMatch.name, 'class'),
                        hasDocumentation: this.hasDocumentation(lines, i),
                        suggestedDocPath: this.getSuggestedDocPath(file.path, classMatch.name)
                    });
                }

                // API route detection
                const apiMatch = this.detectApiRoute(line, ext);
                if (apiMatch) {
                    items.push({
                        type: 'api',
                        name: apiMatch.name,
                        filePath: file.path,
                        lineNumber,
                        signature: apiMatch.signature,
                        priority: 'high', // APIs are always high priority
                        hasDocumentation: this.hasDocumentation(lines, i),
                        suggestedDocPath: this.getSuggestedDocPath(file.path, apiMatch.name)
                    });
                }
            }

            return items;
        } catch (error) {
            console.error(`Error analyzing file ${file.path}:`, error);
            return [];
        }
    }

    private detectFunction(line: string, ext: string): {name: string, signature: string} | null {
        // TypeScript/JavaScript function detection
        if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
            const patterns = [
                /function\s+(\w+)\s*\(/,
                /const\s+(\w+)\s*=\s*(?:async\s+)?\(/,
                /(\w+)\s*:\s*(?:async\s+)?\(/,
                /export\s+(?:async\s+)?function\s+(\w+)\s*\(/
            ];
            
            for (const pattern of patterns) {
                const match = line.match(pattern);
                if (match) {
                    return {
                        name: match[1],
                        signature: line.trim()
                    };
                }
            }
        }
        
        // Python function detection
        if (ext === '.py') {
            const match = line.match(/def\s+(\w+)\s*\(/);
            if (match) {
                return {
                    name: match[1],
                    signature: line.trim()
                };
            }
        }
        
        return null;
    }

    private detectClass(line: string, ext: string): {name: string, signature: string} | null {
        // TypeScript/JavaScript class detection
        if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
            const match = line.match(/class\s+(\w+)/);
            if (match) {
                return {
                    name: match[1],
                    signature: line.trim()
                };
            }
        }
        
        // Python class detection
        if (ext === '.py') {
            const match = line.match(/class\s+(\w+)/);
            if (match) {
                return {
                    name: match[1],
                    signature: line.trim()
                };
            }
        }
        
        return null;
    }

    private detectApiRoute(line: string, ext: string): {name: string, signature: string} | null {
        // API route detection for common frameworks
        if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
            const patterns = [
                /app\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/,
                /router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/,
                /\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/
            ];
            
            for (const pattern of patterns) {
                const match = line.match(pattern);
                if (match) {
                    return {
                        name: `${match[1].toUpperCase()} ${match[2]}`,
                        signature: line.trim()
                    };
                }
            }
        }
        
        return null;
    }

    private hasDocumentation(lines: string[], lineIndex: number): boolean {
        // Check for JSDoc comments above the function/class
        for (let i = Math.max(0, lineIndex - 10); i < lineIndex; i++) {
            const line = lines[i].trim();
            if (line.includes('/**') || line.includes('* @') || line.includes('* @param')) {
                return true;
            }
        }
        return false;
    }

    private determinePriority(name: string, type: string): 'high' | 'medium' | 'low' {
        // High priority: public APIs, main functions, core classes
        if (type === 'api' || 
            name.startsWith('public') || 
            name.includes('main') || 
            name.includes('core') ||
            name.includes('auth') ||
            name.includes('user')) {
            return 'high';
        }
        
        // Medium priority: utility functions, helper classes
        if (name.includes('util') || 
            name.includes('helper') || 
            name.includes('service') ||
            name.includes('manager')) {
            return 'medium';
        }
        
        // Low priority: private functions, internal classes
        return 'low';
    }

    private getSuggestedDocPath(filePath: string, itemName: string): string {
        const dir = path.dirname(filePath);
        const baseName = path.basename(filePath, path.extname(filePath));
        return path.join(dir, `${baseName}.${itemName}.md`);
    }

    private categorizeByPriority(items: CodeItem[]) {
        return {
            high: items.filter(item => item.priority === 'high'),
            medium: items.filter(item => item.priority === 'medium'),
            low: items.filter(item => item.priority === 'low')
        };
    }

    private categorizeByType(items: CodeItem[]) {
        return {
            functions: items.filter(item => item.type === 'function'),
            classes: items.filter(item => item.type === 'class'),
            interfaces: items.filter(item => item.type === 'interface'),
            apis: items.filter(item => item.type === 'api'),
            configs: items.filter(item => item.type === 'config'),
            components: items.filter(item => item.type === 'component')
        };
    }

    private async analyzeProjectStructure(files: vscode.Uri[]): Promise<ProjectStructure> {
        const framework = this.detectFramework(files);
        const architecture = this.detectArchitecture(files);
        const hasFrontend = this.hasFrontend(files);
        const hasBackend = this.hasBackend(files);
        const hasDatabase = this.hasDatabase(files);
        const hasTests = this.hasTests(files);
        
        const domains = await this.identifyDomains(files);
        
        const totalFiles = files.length;
        const codeFiles = files.filter(f => this.codeExtensions.includes(path.extname(f.path).toLowerCase())).length;
        const docFiles = files.filter(f => this.docExtensions.includes(path.extname(f.path).toLowerCase())).length;
        const coverage = totalFiles > 0 ? Math.round((docFiles / totalFiles) * 100) : 0;

        return {
            framework,
            architecture,
            hasFrontend,
            hasBackend,
            hasDatabase,
            hasTests,
            domains,
            totalFiles,
            codeFiles,
            docFiles,
            coverage
        };
    }

    private detectFramework(files: vscode.Uri[]): string {
        const filePaths = files.map(f => f.path);
        const frameworkPatterns = {
            'React': [/import.*from ['"]react['"]/, /\.tsx?$/, /\.jsx?$/],
            'Vue': [/import.*from ['"]vue['"]/, /\.vue$/],
            'Angular': [/import.*from ['"]@angular/, /\.component\.ts$/],
            'Express': [/import.*from ['"]express['"]/, /app\.(get|post|put|delete)/],
            'FastAPI': [/from fastapi import/, /@app\.(get|post|put|delete)/],
            'Spring Boot': [/@RestController/, /@Service/, /@Repository/],
            'Next.js': [/import.*from ['"]next['"]/, /pages\//, /app\//],
            'NestJS': [/@Controller/, /@Injectable/, /@Module/]
        };
        
        for (const [framework, patterns] of Object.entries(frameworkPatterns)) {
            if (patterns.some(pattern => 
                filePaths.some(path => pattern.test(path))
            )) {
                return framework;
            }
        }
        
        return 'Unknown';
    }

    private detectArchitecture(files: vscode.Uri[]): string {
        const filePaths = files.map(f => f.path);
        
        if (filePaths.some(p => p.includes('microservices') || p.includes('services/'))) {
            return 'Microservices';
        }
        if (filePaths.some(p => p.includes('src/') && p.includes('components/') && p.includes('services/'))) {
            return 'Layered Architecture';
        }
        if (filePaths.some(p => p.includes('api/') && p.includes('models/') && p.includes('controllers/'))) {
            return 'MVC';
        }
        
        return 'Monolithic';
    }

    private hasFrontend(files: vscode.Uri[]): boolean {
        return files.some(f => 
            f.path.includes('src/') && 
            (f.path.endsWith('.tsx') || f.path.endsWith('.jsx') || f.path.endsWith('.vue'))
        );
    }

    private hasBackend(files: vscode.Uri[]): boolean {
        return files.some(f => 
            f.path.includes('api/') || 
            f.path.includes('server/') || 
            f.path.includes('routes/') ||
            f.path.includes('controllers/')
        );
    }

    private hasDatabase(files: vscode.Uri[]): boolean {
        return files.some(f => 
            f.path.includes('models/') || 
            f.path.includes('schema/') || 
            f.path.includes('migrations/') ||
            f.path.endsWith('.sql')
        );
    }

    private hasTests(files: vscode.Uri[]): boolean {
        return files.some(f => 
            f.path.includes('test/') || 
            f.path.includes('__tests__/') || 
            f.path.endsWith('.test.ts') || 
            f.path.endsWith('.spec.ts')
        );
    }

    private async identifyDomains(files: vscode.Uri[]): Promise<ProjectDomain[]> {
        const domains: ProjectDomain[] = [];
        const domainMap = new Map<string, ProjectDomain>();

        for (const file of files) {
            const ext = path.extname(file.path).toLowerCase();
            if (!this.codeExtensions.includes(ext)) continue;

            const relativePath = vscode.workspace.asRelativePath(file);
            const domainName = this.extractDomainName(relativePath);
            
            if (!domainMap.has(domainName)) {
                domainMap.set(domainName, {
                    name: domainName,
                    type: this.determineDomainType(relativePath),
                    files: [],
                    endpoints: [],
                    classes: [],
                    functions: [],
                    description: this.generateDomainDescription(domainName),
                    priority: this.determineDomainPriority(domainName)
                });
            }

            const domain = domainMap.get(domainName)!;
            domain.files.push(relativePath);

            // Analyze file content for domain-specific items
            const codeItems = await this.analyzeCodeFile(file);
            domain.endpoints.push(...codeItems.filter(item => item.type === 'api'));
            domain.classes.push(...codeItems.filter(item => item.type === 'class'));
            domain.functions.push(...codeItems.filter(item => item.type === 'function'));
        }

        return Array.from(domainMap.values());
    }

    private extractDomainName(filePath: string): string {
        const parts = filePath.split('/');
        
        // Look for common domain indicators
        if (parts.includes('auth') || parts.includes('authentication')) return 'Authentication';
        if (parts.includes('user') || parts.includes('users')) return 'User Management';
        if (parts.includes('product') || parts.includes('products')) return 'Product Management';
        if (parts.includes('order') || parts.includes('orders')) return 'Order Management';
        if (parts.includes('payment') || parts.includes('payments')) return 'Payment Processing';
        if (parts.includes('notification') || parts.includes('notifications')) return 'Notifications';
        if (parts.includes('admin') || parts.includes('administration')) return 'Administration';
        if (parts.includes('api') || parts.includes('routes')) return 'API Routes';
        if (parts.includes('service') || parts.includes('services')) return 'Business Services';
        if (parts.includes('util') || parts.includes('utils')) return 'Utilities';
        if (parts.includes('config') || parts.includes('configuration')) return 'Configuration';
        
        // Default to directory name
        return parts[parts.length - 2] || 'Core';
    }

    private determineDomainType(filePath: string): ProjectDomain['type'] {
        if (filePath.includes('api/') || filePath.includes('routes/')) return 'api';
        if (filePath.includes('service/') || filePath.includes('services/')) return 'service';
        if (filePath.includes('component/') || filePath.includes('components/')) return 'component';
        if (filePath.includes('util/') || filePath.includes('utils/')) return 'utility';
        if (filePath.includes('config/') || filePath.includes('configuration/')) return 'config';
        return 'service';
    }

    private generateDomainDescription(domainName: string): string {
        const descriptions: Record<string, string> = {
            'Authentication': 'User authentication, authorization, and security management',
            'User Management': 'User profiles, registration, and account management',
            'Product Management': 'Product catalog, inventory, and product-related operations',
            'Order Management': 'Order processing, fulfillment, and order tracking',
            'Payment Processing': 'Payment gateway integration and transaction handling',
            'Notifications': 'Email, SMS, and push notification services',
            'Administration': 'Admin panel, user management, and system administration',
            'API Routes': 'REST API endpoints and route handlers',
            'Business Services': 'Core business logic and service layer',
            'Utilities': 'Helper functions, common utilities, and shared code',
            'Configuration': 'Application configuration and environment settings',
            'Core': 'Core application functionality and main components'
        };
        
        return descriptions[domainName] || `Core functionality for ${domainName.toLowerCase()}`;
    }

    private determineDomainPriority(domainName: string): 'high' | 'medium' | 'low' {
        const highPriority = ['Authentication', 'User Management', 'API Routes', 'Core'];
        const mediumPriority = ['Product Management', 'Order Management', 'Payment Processing', 'Business Services'];
        
        if (highPriority.includes(domainName)) return 'high';
        if (mediumPriority.includes(domainName)) return 'medium';
        return 'low';
    }

    private async generateDocumentationTasks(files: vscode.Uri[], docTasks: { type: 'missing' | 'outdated'; title: string; description: string; priority: 'high' | 'medium' | 'low'; suggestedAction: string }[]): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return;

        // Check for missing core documentation files
        const coreDocs = [
            { name: 'README.md', priority: 'high' as const, description: 'Project overview, setup instructions, and getting started guide' },
            { name: 'API.md', priority: 'high' as const, description: 'API documentation with endpoints, parameters, and examples' },
            { name: 'ARCHITECTURE.md', priority: 'medium' as const, description: 'System architecture, components, and design decisions' },
            { name: 'SETUP.md', priority: 'medium' as const, description: 'Development environment setup and configuration' },
            { name: 'CHANGELOG.md', priority: 'low' as const, description: 'Version history and release notes' },
            { name: 'CONTRIBUTING.md', priority: 'low' as const, description: 'Guidelines for contributing to the project' }
        ];

        for (const doc of coreDocs) {
            // Determine if file should be in root or docs directory
            const isRootFile = ['README.md', 'CHANGELOG.md'].includes(doc.name);
            const docPath = isRootFile ? 
                vscode.Uri.joinPath(workspaceFolder.uri, doc.name) :
                vscode.Uri.joinPath(workspaceFolder.uri, 'docs', doc.name);
            try {
                await vscode.workspace.fs.stat(docPath);
                // File exists, check if it's outdated (basic check)
                const content = await vscode.workspace.fs.readFile(docPath);
                const contentStr = Buffer.from(content).toString('utf-8');
                
                if (this.isDocumentationOutdated(contentStr, doc.name)) {
                    docTasks.push({
                        type: 'outdated',
                        title: `Update ${doc.name}`,
                        description: `${doc.description} - Content appears outdated`,
                        priority: doc.priority,
                        suggestedAction: `Update ${doc.name}`
                    });
                }
                // If file exists and is not outdated, don't add any task
            } catch {
                // File doesn't exist
                console.log(`Core doc missing: ${doc.name} - creating task: Create ${doc.name}`);
                docTasks.push({
                    type: 'missing',
                    title: `Create ${doc.name}`,
                    description: doc.description,
                    priority: doc.priority,
                    suggestedAction: `Generate ${doc.name}`
                });
            }
        }

        // Check for domain-specific documentation
        const domains = await this.identifyDomains(files);
        for (const domain of domains) {
            if (domain.priority === 'high') {
                const domainDocName = `${domain.name.toUpperCase()}.md`;
                const domainDocPath = vscode.Uri.joinPath(workspaceFolder.uri, 'docs', domainDocName);
                
                try {
                    await vscode.workspace.fs.stat(domainDocPath);
                    // File exists, check if it's outdated
                    const content = await vscode.workspace.fs.readFile(domainDocPath);
                    const contentStr = Buffer.from(content).toString('utf-8');
                    
                    if (this.isDocumentationOutdated(contentStr, domainDocName)) {
                        docTasks.push({
                            type: 'outdated',
                            title: `Update ${domainDocName}`,
                            description: `Documentation for ${domain.name} domain with ${domain.files.length} files - Content appears outdated`,
                            priority: 'medium',
                            suggestedAction: `Update ${domainDocName}`
                        });
                    }
                    // If file exists and is not outdated, don't add any task
                } catch {
                    docTasks.push({
                        type: 'missing',
                        title: `Create ${domainDocName}`,
                        description: `Documentation for ${domain.name} domain with ${domain.files.length} files`,
                        priority: 'medium',
                        suggestedAction: `Generate ${domainDocName}`
                    });
                }
            }
        }

        // Check for API documentation if backend exists
        const hasBackend = this.hasBackend(files);
        if (hasBackend) {
            const apiDocPath = vscode.Uri.joinPath(workspaceFolder.uri, 'docs', 'API.md');
            try {
                await vscode.workspace.fs.stat(apiDocPath);
                console.log(`API.md file exists at: ${apiDocPath.toString()}`);
                // File exists, check if it's outdated
                const content = await vscode.workspace.fs.readFile(apiDocPath);
                const contentStr = Buffer.from(content).toString('utf-8');
                
                if (this.isDocumentationOutdated(contentStr, 'API.md')) {
                    docTasks.push({
                        type: 'outdated',
                        title: 'Update API Documentation',
                        description: 'Comprehensive API documentation with endpoints, schemas, and examples - Content appears outdated',
                        priority: 'high',
                        suggestedAction: 'Update API Documentation'
                    });
                }
                // If file exists and is not outdated, don't add any task
            } catch {
                docTasks.push({
                    type: 'missing',
                    title: 'Create API Documentation',
                    description: 'Comprehensive API documentation with endpoints, schemas, and examples',
                    priority: 'high',
                    suggestedAction: 'Generate API Documentation'
                });
            }
        }
    }

    private isDocumentationOutdated(content: string, docName: string): boolean {
        // Basic heuristics to detect outdated documentation
        const lowerContent = content.toLowerCase();
        
        // Check for common outdated indicators
        if (lowerContent.includes('todo') || lowerContent.includes('fixme') || lowerContent.includes('xxx')) {
            return true;
        }
        
        // Check for placeholder content
        if (lowerContent.includes('placeholder') || lowerContent.includes('coming soon') || lowerContent.includes('tbd')) {
            return true;
        }
        
        // Check for very short content (likely incomplete) - but be more lenient
        if (content.trim().length < 50) {
            return true;
        }
        
        // Check for specific outdated patterns - but be more lenient for generated content
        if (docName === 'README.md' && !lowerContent.includes('installation') && !lowerContent.includes('setup') && !lowerContent.includes('overview')) {
            return true;
        }
        
        if (docName === 'API.md' && !lowerContent.includes('endpoint') && !lowerContent.includes('api') && !lowerContent.includes('documentation')) {
            return true;
        }
        
        // Don't mark as outdated if it contains generated content markers
        if (lowerContent.includes('generated by codenection') || lowerContent.includes('draft documentation')) {
            return false;
        }
        
        // For newly generated content, be more lenient - if it has substantial content, consider it current
        if (content.trim().length > 100 && !lowerContent.includes('placeholder') && !lowerContent.includes('todo')) {
            return false;
        }
        
        // Check for specific content that indicates the file is properly generated
        if (docName === 'API.md' && (lowerContent.includes('endpoint') || lowerContent.includes('api') || lowerContent.includes('documentation'))) {
            return false;
        }
        
        if (docName === 'ARCHITECTURE.md' && (lowerContent.includes('architecture') || lowerContent.includes('component') || lowerContent.includes('system'))) {
            return false;
        }
        
        if (docName === 'SETUP.md' && (lowerContent.includes('setup') || lowerContent.includes('install') || lowerContent.includes('configuration'))) {
            return false;
        }
        
        if (docName === 'CONTRIBUTING.md' && (lowerContent.includes('contributing') || lowerContent.includes('guideline') || lowerContent.includes('pull request'))) {
            return false;
        }
        
        if (docName === 'CHANGELOG.md' && (lowerContent.includes('changelog') || lowerContent.includes('version') || lowerContent.includes('release'))) {
            return false;
        }
        
        return false; // Default to not outdated for generated content
    }

    private getEmptyAnalysis(): WorkspaceAnalysis {
        return {
            projectStructure: {
                framework: 'Unknown',
                architecture: 'Monolithic',
                hasFrontend: false,
                hasBackend: false,
                hasDatabase: false,
                hasTests: false,
                domains: [],
                totalFiles: 0,
                codeFiles: 0,
                docFiles: 0,
                coverage: 0
            },
            missingDocs: [],
            byPriority: { high: [], medium: [], low: [] },
            byType: { functions: [], classes: [], interfaces: [], apis: [], configs: [], components: [] },
            fileTypes: {},
            docTasks: [],
            totalFiles: 0,
            docFiles: 0,
            codeFiles: 0,
            docCoverage: 0
        };
    }
}
