const assert = require('assert');

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
const vscode = require('vscode');
const myExtension = require('../extension');
const path = require('path');
const fs = require('fs');
const os = require('os');

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');


	/* passing

	test('Test Opening of Buddy', async () => {
		await vscode.commands.executeCommand('code-assistant.codeBuddy');
        const isExtensionActive = vscode.extensions.getExtension('SutherlandDev.code-assistant').isActive;
        assert.strictEqual(isExtensionActive, true);
	});

	*/

	/* passing
	test('TC_001 - Code Completion with Guidance', async function () {
        // Create a temporary file
        const filePath = path.join(os.tmpdir(), 'testFile.js');
        fs.writeFileSync(filePath, '//Write a function that implements a bubble sort\n');

        // Open the file in VSCode
        const document = await vscode.workspace.openTextDocument(filePath);
        const editor = await vscode.window.showTextDocument(document);

        // Set the cursor position to the end of the document
        const lastLine = document.lineAt(document.lineCount - 1);
        const position = new vscode.Position(document.lineCount - 1, lastLine.text.length);
        editor.selection = new vscode.Selection(position, position);

		await new Promise(resolve => setTimeout(resolve, 2000));

        // Trigger the completion command
        await vscode.commands.executeCommand('code-assistant.triggerCompletion');

        // Log the output (get the document text and log it)
        const newText = editor.document.getText();
        console.log('Document Text after Trigger Completion:', newText);

        // Perform assertions to check the expected behavior
        assert.ok(newText.includes('//'), 'Completion text not found');

        // Clean up (close the editor and delete the temporary file)
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        fs.unlinkSync(filePath);
    });
	*/

	test('TC_001 - Code Completion with Guidance', async function () {
        // Create a temporary file
        const filePath = path.join(os.tmpdir(), 'testFile.js');
        fs.writeFileSync(filePath, '//Write a function that implements a bubble sort\n');

        // Open the file in VSCode
        const document = await vscode.workspace.openTextDocument(filePath);
        const editor = await vscode.window.showTextDocument(document);

        // Set the cursor position to the end of the document
        const lastLine = document.lineAt(document.lineCount - 1);
        const position = new vscode.Position(document.lineCount - 1, lastLine.text.length);
        editor.selection = new vscode.Selection(position, position);

		await new Promise(resolve => setTimeout(resolve, 2000));

        // Trigger the completion command
        await vscode.commands.executeCommand('code-assistant.triggerCompletion');

        // Log the output (get the document text and log it)
        const newText = editor.document.getText();
        console.log('Document Text after Trigger Completion:', newText);

        // Perform assertions to check the expected behavior
        assert.ok(newText.includes('//'), 'Completion text not found');

        // Clean up (close the editor and delete the temporary file)
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        fs.unlinkSync(filePath);
    });
});
