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


	/* PASSING

	test('Test Opening of Buddy', async () => {
		await vscode.commands.executeCommand('code-assistant.codeBuddy');
        const isExtensionActive = vscode.extensions.getExtension('SutherlandDev.code-assistant').isActive;
        assert.strictEqual(isExtensionActive, true);
	});

	test('TC_001 - Code Completion with Guidance', async function () {
        // Create a temporary file
        const filePath = path.join(os.tmpdir(), 'tc001.js');
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

	test('TC_002 - Code Completion with Half Completed Function', async function () {
        // Create a temporary file
        const filePath = path.join(os.tmpdir(), 'tc002.js');
        fs.writeFileSync(filePath, `function kmpSearch(text, pattern) {
        const partialMatchTable = buildPartialMatchTable(pattern);
        const n = text.length;
        const m = pattern.length;
        let i = 0; // index for text
        let j = 0; // index for pattern

        while (i < n) {
            if (pattern[j] === text[i]) {
                i++;
                j++;
            }`);

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
        assert.ok(newText.includes('kmpSearch'), 'Completion text not found');

        // Clean up (close the editor and delete the temporary file)
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        fs.unlinkSync(filePath);
    });


    test('TC_003 - Code Completion with No Guidance', async function () {
        // Create a temporary file
        const filePath = path.join(os.tmpdir(), 'tc003.js');
        fs.writeFileSync(filePath, `class School {
    constructor(name, address) {
        this.name = name;
        this.address = address;
        this.students = [];
        this.teachers = [];
        this.courses = [];
    }

    // Method to add a student
    addStudent(student) {
        this.students.push(student);
    }

    // Method to remove a student by ID
    removeStudent(studentId) {
        this.students = this.students.filter(student => student.id !== studentId);
    }`);

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
        assert.ok(newText.includes('School'), 'Completion text not found');

        // Clean up (close the editor and delete the temporary file)
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        fs.unlinkSync(filePath);
    });

    test('TC_004 - Abort Code Completion', async function () {
        // Create a temporary file
        const filePath = path.join(os.tmpdir(), 'tc004.js');
        fs.writeFileSync(filePath, `class School {
    constructor(name, address) {
        this.name = name;
        this.address = address;
        this.students = [];
        this.teachers = [];
        this.courses = [];
    }

    // Method to add a student
    addStudent(student) {
        this.students.push(student);
    }

    // Method to remove a student by ID
    removeStudent(studentId) {
        this.students = this.students.filter(student => student.id !== studentId);
    }`);

        // Open the file in VSCode
        const document = await vscode.workspace.openTextDocument(filePath);
        const editor = await vscode.window.showTextDocument(document);

        // Set the cursor position to the end of the document
        const lastLine = document.lineAt(document.lineCount - 1);
        const position = new vscode.Position(document.lineCount - 1, lastLine.text.length);
        editor.selection = new vscode.Selection(position, position);

        await new Promise(resolve => setTimeout(resolve, 2000));

        // Trigger the completion command
        vscode.commands.executeCommand('code-assistant.triggerCompletion');

        await new Promise(resolve => setTimeout(resolve, 4000));

        vscode.commands.executeCommand('code-assistant.triggerCompletion');

        // Log the output (get the document text and log it)
        const newText = editor.document.getText();
        console.log('Document Text after Trigger Completion:', newText);

        // Perform assertions to check the expected behavior
        assert.ok(newText.includes('School'), 'Completion text not found');

        // Clean up (close the editor and delete the temporary file)
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        fs.unlinkSync(filePath);
    });

    test('TC_005 - Debug Code with Syntax Error', async function () {
        // Create a temporary file
        const filePath = path.join(os.tmpdir(), 'tc005.js');
        fs.writeFileSync(filePath, `function quickSort(ar) {
    if (arr.length <= 1) {
        return arr;
    }

    const pivot = arr[Math.flor(arr.length / 2)];
    const left = [];
    const right = [];

    for (let i  0; i < arr.lenth; i++) {
        if (i == Math.floor(arr.length / 2)) contine; // Skip the pivot element
        if (arr[i] < pivot) 
            left.push(arr[i]);
        } else {
            rightpush(arr[i])
        }
    }

    return [..quicSort(left), pvot, ...qickSort(right)];
}`);

        // Open the file in VSCode
        const document = await vscode.workspace.openTextDocument(filePath);
        const editor = await vscode.window.showTextDocument(document);

        // Set the cursor position to the end of the document
        const start = new vscode.Position(0, 0);
        const end = new vscode.Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length);
        editor.selection = new vscode.Selection(start, end);

        await new Promise(resolve => setTimeout(resolve, 2000));

        // Trigger the completion command
        await vscode.commands.executeCommand('extension.debugWithCodeBuddy');

        // Log the output (get the document text and log it)
        const newText = editor.document.getText();
        console.log('Document Text after Debugging:', newText);

        // Perform assertions to check the expected behavior
        assert.ok(newText.includes('quickSort'), 'Completion text not found');

        // Clean up (close the editor and delete the temporary file)
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        fs.unlinkSync(filePath);
    });

    test('TC_006 - Debug Code with Semantic Error', async function () {
        // Create a temporary file
        const filePath = path.join(os.tmpdir(), 'tc006.js');
        fs.writeFileSync(filePath, 
            `function quickSort(arr) {
                    if (arr.length < 1) {
                        return arr;
                    }

                    const pivot = arr[Math.floor(arr.length / 3)];
                    const left = [];
                    const right = [];

                    for (let i = 0; i < arr.length; i--) {
                        if (i === Math.floor(arr.length / 2)) continue; // Skip the pivot element
                        if (arr[i] < pivot) {
                            right.push(arr[i]);
                        } else {
                            left.push(arr[i]);
                        }
                    }

                    return [...quickSort(right), pivot, ...quickSort(right)];
                }
        `);

        // Open the file in VSCode
        const document = await vscode.workspace.openTextDocument(filePath);
        const editor = await vscode.window.showTextDocument(document);

        // Set the cursor position to the end of the document
        const start = new vscode.Position(0, 0);
        const end = new vscode.Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length);
        editor.selection = new vscode.Selection(start, end);

        await new Promise(resolve => setTimeout(resolve, 2000));

        // Trigger the completion command
        await vscode.commands.executeCommand('extension.debugWithCodeBuddy');

        // Log the output (get the document text and log it)
        const newText = editor.document.getText();
        console.log('Document Text after Debugging:', newText);

        // Perform assertions to check the expected behavior
        assert.ok(newText.includes('quickSort'), 'Completion text not found');

        // Clean up (close the editor and delete the temporary file)
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        fs.unlinkSync(filePath);
    });

    */
});
