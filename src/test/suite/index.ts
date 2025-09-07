import * as assert from 'assert';
import { after } from 'mocha';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('codenection-ai-docs'));
  });

  test('Should activate', async () => {
    const ext = vscode.extensions.getExtension('codenection-ai-docs');
    if (ext) {
      await ext.activate();
      assert.ok(true);
    }
  });

  test('Should register commands', async () => {
    const commands = await vscode.commands.getCommands();
    assert.ok(commands.includes('codenection.openChat'));
    assert.ok(commands.includes('codenection.uploadDocument'));
    assert.ok(commands.includes('codenection.searchDocs'));
  });
}); 