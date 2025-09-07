import { spawn } from 'child_process';
import * as vscode from 'vscode';

function runGit(args: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = spawn('git', args, { cwd });
        let out = '';
        let err = '';
        child.stdout.on('data', d => out += d.toString());
        child.stderr.on('data', d => err += d.toString());
        child.on('close', code => {
            if (code === 0) resolve(out.trim());
            else reject(new Error(err || `git ${args.join(' ')} failed with code ${code}`));
        });
    });
}

export async function draftChangelogSinceLastTag(): Promise<string> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) return 'No workspace open.';
    const cwd = folders[0].uri.fsPath;

    try {
        const lastTag = await runGit(['describe', '--tags', '--abbrev=0'], cwd).catch(()=>'');
        const range = lastTag ? `${lastTag}..HEAD` : 'HEAD';
        const log = await runGit(['log', '--pretty=%s||%h||%an||%ad', '--date=short', range], cwd);
        const lines = log.split('\n').filter(Boolean);

        const groups: Record<string, Array<{ s: string; h: string; a: string; d: string }>> = {
            feat: [], fix: [], chore: [], refactor: [], docs: [], test: [], other: []
        };
        for (const line of lines) {
            const [s, h, a, d] = line.split('||');
            const key = s.startsWith('feat') ? 'feat' : s.startsWith('fix') ? 'fix' : s.startsWith('chore') ? 'chore' : s.startsWith('refactor') ? 'refactor' : s.startsWith('docs') ? 'docs' : s.startsWith('test') ? 'test' : 'other';
            groups[key].push({ s, h, a, d });
        }

        const order = ['feat','fix','docs','refactor','test','chore','other'];
        let md = `# Changelog Draft\n\n`;
        md += lastTag ? `Changes since ${lastTag}:\n\n` : `Changes in this repository:\n\n`;
        for (const k of order) {
            if (groups[k].length === 0) continue;
            md += `## ${k}\n`;
            for (const { s, h, a, d } of groups[k]) {
                md += `- ${s} (${h}, ${a}, ${d})\n`;
            }
            md += `\n`;
        }
        return md.trim() || 'No commits found.';
    } catch (err) {
        return `Failed to draft changelog: ${(err as Error).message}`;
    }
}

export async function draftApiDocsBasic(): Promise<string> {
    // Simple, fast scan: list TS/JS files and show placeholder routes.
    const files = await vscode.workspace.findFiles('**/*.{ts,tsx,js,jsx}', '**/node_modules/**');
    const list = files.slice(0, 50).map(u => '- ' + vscode.workspace.asRelativePath(u)).join('\n');
    return `# API Docs Draft (placeholder)\n\nScanned files (subset):\n${list}\n\nDetected routes (placeholder):\n- GET /api/health\n- POST /api/users\n- PUT /api/users/{id}\n`;
}


