// // The module 'vscode' contains the VS Code extensibility API

// // Import the module and reference it with the alias vscode in your code below
// const vscode = require('vscode');
// const { Ollama } = require("@langchain/community/llms/ollama");
// const pdfParse = require('pdf-parse');
// const { exec } = require('child_process');
// const {OpenAI} = require("openai");
// const AbortController = require('abort-controller');


// let selectedText = '';
// let uploadedFileText = '';
// let activeEditor = null;
// let isGPT = false;
// let currentStream = null;

// let ollama = new Ollama({
// 	baseUrl: "http://localhost:11434", // Default value
// 	model: "phi3", // Default value
//   });


// const openai = new OpenAI({
// 	apiKey: "sk-proj-M6ZLbZbpndRH2OSr87PKT3BlbkFJMAbUFWQUx1Wwe4vdZ1vy"
// });
// let abortController = new AbortController();


// // This method is called when your extension is activated
// // Your extension is activated the very first time the command is executed

// /**
//  * @param {vscode.ExtensionContext} context
//  */
// function activate(context) {

// 	// Use the console to output diagnostic information (console.log) and errors (console.error)
// 	// This line of code will only be executed once when your extension is activated
// 	console.log('Congratulations, your extension "code-assistant" is now active!');

// 	exec('ollama serve', (err, stdout, stderr) => {
//         if (err) {
//             console.error(`Error starting ollama serve: ${err}`);
//             return;
//         }
//         console.log(`ollama serve output: ${stdout}`);
//         console.error(`ollama serve error output: ${stderr}`);
//     });


// 	vscode.window.onDidChangeTextEditorSelection(event => {
// 		const editor = event.textEditor;
// 		if (editor) {
// 			activeEditor = editor;
// 			const selection = editor.selection;
// 			selectedText = editor.document.getText(selection);
// 		}
// 	});


//     let other = vscode.commands.registerCommand('code-assistant.openChat', function () {
//         // Create and show a new panel
//         const panel = vscode.window.createWebviewPanel(
//             'chatPanel',
//             'Chat',
//             vscode.ViewColumn.Beside,
//             {
// 				enableScripts: true
// 			  }
//         );

// 		const updateWebview = (information) => {
// 			panel.webview.html = getWebviewContent(information);
// 		  };

//       panel.webview.html = getWebviewContent("Hi there! Ask me anything");

// 	  panel.webview.onDidReceiveMessage(
// 		async message => {
// 			if (message.command === 'sendInput') {
				
// 				let userInput = message.text;

// 				if (selectedText) {
// 					userInput = userInput + ". Here is the highlighted code: " + selectedText;
// 				}

// 				if(uploadedFileText) {
// 					userInput = userInput + ". Here is the relevant file: " + uploadedFileText;
// 				}

// 				console.log(userInput);

// 				if(isGPT) {
// 					try {
//                         const response = await openai.chat.completions.create({
//                             model: "gpt-3.5-turbo",
//                             messages: [{"role": "user", content: userInput }],
//                             stream: true,
//                         });

//                         let codeMode = false;
//                         let codeId = null;
//                         let textId = "textId-" + Date.now();
//                         const messageId = Date.now(); // Unique identifier for the message

//                         panel.webview.postMessage({ command: 'startBotMessage', id: messageId });
//                         panel.webview.postMessage({ command: 'startBotText', id: messageId, textId: textId });

// 						for await (const chunk of response) {
// 							chunk = chunk.choices[0].delta
// 							if (chunk.includes("```")) {
// 								codeMode = !codeMode;
// 								if (codeMode) {
// 									codeId = "codeId-" + Date.now();
// 									panel.webview.postMessage({ command: 'startBotCode', id: messageId, codeId: codeId });
// 								} else {
// 									textId = "textId-" + Date.now();
// 									panel.webview.postMessage({ command: 'startBotText', id: messageId, textId: textId });
// 								}
// 								continue;
// 							}
		
// 							if (codeMode) {
// 								panel.webview.postMessage({ command: 'updateBotCode', id: messageId, codeId: codeId, code: chunk });
// 							} else {
// 								panel.webview.postMessage({ command: 'updateBotText', id: messageId, textId: textId, text: chunk });
// 							}
// 						}

//                     } catch (error) {
//                         console.error(`Error calling OpenAI API: ${error}`);
//                     }
// 				} else {
// 					abortController = new AbortController();
// 					currentStream = await ollama.stream(userInput, {signal: abortController.signal});
// 					userInput = '';
// 					selectedText = '';
// 					uploadedFileText = '';
	
// 					const messageId = Date.now(); // Unique identifier for the message
	
// 					panel.webview.postMessage({ command: 'startBotMessage', id: messageId });
	
// 					let codeMode = false;
// 					let codeId = null;
// 					let textId = "textId-" + Date.now();
// 					panel.webview.postMessage({ command: 'startBotText', id: messageId, textId: textId });
	
// 					for await (const chunk of currentStream) {
// 						if (chunk.includes("```")) {
// 							codeMode = !codeMode;
// 							if (codeMode) {
// 								codeId = "codeId-" + Date.now();
// 								panel.webview.postMessage({ command: 'startBotCode', id: messageId, codeId: codeId });
// 							} else {
// 								textId = "textId-" + Date.now();
// 								panel.webview.postMessage({ command: 'startBotText', id: messageId, textId: textId });
// 							}
// 							continue;
// 						}
	
// 						if (codeMode) {
// 							panel.webview.postMessage({ command: 'updateBotCode', id: messageId, codeId: codeId, code: chunk });
// 						} else {
// 							panel.webview.postMessage({ command: 'updateBotText', id: messageId, textId: textId, text: chunk });
// 						}
// 					}
// 					panel.webview.postMessage({ command: 'stopStream' });
// 				}
// 			} else if (message.command === 'stopStream') {
// 				if (currentStream && currentStream.return) {
// 					abortController.abort();
// 					await currentStream.return();
// 				}
// 				panel.webview.postMessage({ command: 'stopStream' });
// 			} else if (message.command === 'uploadFile') {
// 				const file = message.file;
// 				const fileContent = Buffer.from(file, 'base64');
// 				const fileName = message.fileName;
// 				const data = await pdfParse(fileContent);

// 				let uploadedFileName = fileName;
// 				uploadedFileText += data.text;
// 				console.log(uploadedFileText);

// 			} else if (message.command === 'changeModel') {
// 				const selectedModel = message.model.toString();

// 				if(selectedModel == "GPT") {
// 					isGPT = true;
// 				} else {
// 					ollama = new Ollama({
// 						baseUrl: "http://localhost:11434", // Default value
// 						model: selectedModel,
// 					});
// 					isGPT = false;
// 				}
// 				console.log(`Switching to model: ${selectedModel}`);
// 				vscode.window.showInformationMessage(`Model changed to: ${selectedModel}`);
// 			}
// 		},
// 		undefined,
// 		context.subscriptions
// 		);
//     });

// 	context.subscriptions.push(other);
// }

// function updateFileName(fileName) {
//     const fileNameElement = document.getElementById('fileName');
//     if (fileName) {
//         fileNameElement.textContent = fileName;
//         fileNameElement.classList.add('success');
//     } else {
//         fileNameElement.textContent = '';
//         fileNameElement.classList.remove('success');
//     }
// }

// function getWebviewContent(information) {
// 	return `<!DOCTYPE html>
// 	<html lang="en">
// 	<head>
// 		<meta charset="UTF-8">
// 		<meta name="viewport" content="width=device-width, initial-scale=1.0">
// 		<title>Chat Interface</title>
// 		<style>
// 			body {
// 				font-family: Arial, sans-serif;
// 				margin: 0;
// 				padding: 0;
// 				display: flex;
// 				flex-direction: column;
// 				height: 100vh;
// 			}
// 			#header {
//                 display: flex;
//                 justify-content: space-between;
//                 align-items: center;
//                 padding: 10px;
//                 border-bottom: 1px solid #ccc;
//                 box-sizing: border-box;
//             }
//             #modelSelect {
//                 padding: 10px;
//                 font-size: 12px;
//                 border: 1px solid #ccc;
//                 border-radius: 5px;
//                 outline: none;
//             }
// 			#chatContainer {
// 				flex: 1;
// 				display: flex;
// 				flex-direction: column;
// 				padding: 10px;
// 				box-sizing: border-box;
// 				overflow-y: auto;
// 				border-bottom: 1px solid #ccc;
// 			}
// 			.message {
// 				margin-bottom: 10px;
// 				padding: 8px 12px;
// 				border-radius: 15px;
// 				max-width: 100%;
// 				color: black;
// 			}
// 			.userMessage {
// 				align-self: flex-end;
// 				background-color: #dcf8c6;
// 			}
// 			.botMessage {
// 				align-self: flex-start;
// 				background-color: #ececec;
// 			}
// 			#inputContainer {
// 				display: flex;
// 				padding: 10px;
// 				border-top: 1px solid #ccc;
// 				box-sizing: border-box;
// 			}
// 			#inputBox {
// 				flex: 1;
// 				padding: 10px;
// 				font-size: 16px;
// 				border: 1px solid #ccc;
// 				border-radius: 5px;
// 				outline: none;
// 			}
// 			#uploadButton {
// 				padding: 10px 20px;
// 				font-size: 16px;
// 				margin-left: 10px;
// 				border: none;
// 				background-color: #4CAF50;
// 				color: white;
// 				border-radius: 5px;
// 				cursor: pointer;
// 			}
// 			#uploadButton:hover {
// 				background-color: #45a049;
// 			}

// 			#sendButton {
// 				padding: 10px 20px;
// 				font-size: 16px;
// 				margin-left: 10px;
// 				border: none;
// 				background-color: #4CAF50;
// 				color: white;
// 				border-radius: 5px;
// 				cursor: pointer;
// 			}
// 			#sendButton:hover {
// 				background-color: #45a049;
// 			}
// 			#sendButton.stop {
// 				background-color: red;
// 			}
// 			/* Your existing CSS styles */
// 			#fileName.success::after {
// 				content: ' ✓';
// 				color: green;
// 				margin-left: 5px;
// 			}
// 			#fileName {
// 				margin-bottom: 10px;
// 				margin-left: 10px;
// 				margin-top: 10px;
// 				font-size: 15px /* Add margin-bottom to separate the file name from the input box */
// 			}
// 			pre {
// 				background: #000;
// 				color: #fff;
// 				border: none;
// 				padding: 0;
// 				overflow-x: auto;
// 			}
		
// 			pre code {
// 				display: block;
// 				font-family: 'Fira Code', monospace;
// 				font-size: 14px;
// 				line-height: 1.6;
// 				background: none;
// 				padding: 0;
// 			}
		
// 			.language-plaintext {
// 				color: #fff;
// 			}
		
// 			.language-javascript {
// 				color: #9cdcfe; /* Change to the appropriate color for JavaScript keywords */
// 			}
		
// 			.language-python {
// 				color: #4ec9b0; /* Change to the appropriate color for Python keywords */
// 			}
// 		</style>
// 	</head>
// 	<body>
// 		<div id="header">
//             <div>Select Model:</div>
//             <select id="modelSelect" onchange="changeModel()">
//                 <option value="phi3">phi3</option>
//                 <option value="llama2">llama2</option>
//                 <option value="codellama">codellama</option>
// 				<option value="GPT">GPT</option>
//             </select>
//         </div>
// 		<div id="chatContainer">
// 			<div class="message botMessage">${information}</div>
// 		</div>
// 		<div id="fileName"></div>
// 		<div id="inputContainer">
// 			<input type="text" id="inputBox" placeholder="Type your message here...">
// 			<button id="uploadButton" onclick="uploadFile()">Upload</button>
// 			<button id="sendButton" onclick="sendMessage()">Send</button>
// 		</div>
// 		<script>
// 			const vscode = acquireVsCodeApi();
// 			let isStreaming = false;

// 			function sendMessage() {
// 				const inputBox = document.getElementById('inputBox');
// 				const sendButton = document.getElementById('sendButton');

// 				if(isStreaming) {
// 					vscode.postMessage({
// 						command: 'stopStream'
// 					});
// 					sendButton.textContent = 'Send';
// 					sendButton.disabled = true;
// 					sendButton.classList.remove('stop');
// 					sendButton.style.backgroundColor = '#4CAF50';
// 				} else {
// 					const message = inputBox.value;
// 					if (message.trim()) {
// 						addMessageToChat(message, 'userMessage');
// 						vscode.postMessage({
// 							command: 'sendInput',
// 							text: message
// 						});
// 						inputBox.value = '';
// 						updateFileName('');
// 						sendButton.textContent = 'Stop';
// 						sendButton.classList.add('stop');
// 						isStreaming = true;
// 					}
// 				}

// 			}

// 			function uploadFile() {
//                 const input = document.createElement('input');
//                 input.type = 'file';
//                 input.accept = '.pdf';
//                 input.onchange = async () => {
//                     const file = input.files[0];
//                     const reader = new FileReader();
//                     reader.onload = () => {
//                         const fileContent = reader.result.split(',')[1];
// 						const fileName = file.name;
//                         vscode.postMessage({
//                             command: 'uploadFile',
//                             file: fileContent,
// 							fileName: fileName
//                         });
// 						updateFileName(fileName);
//                     };
//                     reader.readAsDataURL(file);
//                 };
//                 input.click();
// 			}

// 			function updateFileName(fileName) {
// 				const fileNameElement = document.getElementById('fileName');

// 				if(fileName) {
// 					fileNameElement.textContent = fileName;
// 					fileNameElement.classList.add('success');
// 				} else {
// 					fileNameElement.textContent = '';
// 					fileNameElement.classList.remove('success');
// 				}
// 			}

// 			function addMessageToChat(message, className) {
// 				const chatContainer = document.getElementById('chatContainer');
// 				const messageElement = document.createElement('div');
// 				messageElement.className = 'message ' + className;
// 				messageElement.textContent = message;
// 				chatContainer.appendChild(messageElement);
// 				chatContainer.scrollTop = chatContainer.scrollHeight;
// 			}

// 			function startBotMessage(id) {
//                 const chatContainer = document.getElementById('chatContainer');
//                 const messageElement = document.createElement('div');
//                 messageElement.className = 'message botMessage';
//                 messageElement.id = 'botMessage-' + id;
//                 chatContainer.appendChild(messageElement);
//                 chatContainer.scrollTop = chatContainer.scrollHeight;
//             }

// 			function startBotText(id, textId) {
// 				const messageElement = document.getElementById('botMessage-' + id);
// 				const textElement = document.createElement('p');
// 				textElement.id = textId;
// 				messageElement.appendChild(textElement);
				
//                 const chatContainer = document.getElementById('chatContainer');
//                 chatContainer.scrollTop = chatContainer.scrollHeight;
//             }

// 			function updateBotText(id, textId, text) {
//                 const messageElement = document.getElementById('botMessage-' + id);
//                 if (messageElement) {
// 					const textElement = document.getElementById(textId);
//                     textElement.textContent += text;
//                     const chatContainer = document.getElementById('chatContainer');
//                     chatContainer.scrollTop = chatContainer.scrollHeight;
//                 }
//             }


//             function startBotCode(id, codeId) {
//                 const messageElement = document.getElementById('botMessage-' + id);
//                 const preElement = document.createElement('pre');
//                 const codeElement = document.createElement('code');
//                 codeElement.id = codeId;
//                 preElement.appendChild(codeElement);
//                 messageElement.appendChild(preElement);

//                 const chatContainer = document.getElementById('chatContainer');
//                 chatContainer.appendChild(messageElement);
//                 chatContainer.scrollTop = chatContainer.scrollHeight;
//             }

//             function updateBotCode(id, codeId, code) {
// 				const messageElement = document.getElementById('botMessage-' + id);
// 				if (messageElement) {
// 					const codeElement = document.getElementById(codeId);
// 					codeElement.textContent += code;
// 					const chatContainer = document.getElementById('chatContainer');
// 					chatContainer.scrollTop = chatContainer.scrollHeight;
// 				}
// 			}
// 			function changeModel() {
//                 const modelSelect = document.getElementById('modelSelect');
//                 const selectedModel = modelSelect.value;
//                 vscode.postMessage({
//                     command: 'changeModel',
//                     model: selectedModel
//                 });
//             }

// 			// Listen for messages from the extension
// 			window.addEventListener('message', event => {
// 				const message = event.data;
// 				switch (message.command) {
// 					case 'startBotMessage':
// 						startBotMessage(message.id);
// 						break;
// 					case 'startBotText':
// 						startBotText(message.id, message.textId);
// 						break;
// 					case 'updateBotText':
// 						updateBotText(message.id, message.textId, message.text);
// 						break;
// 					case 'startBotCode':
// 						startBotCode(message.id, message.codeId);
// 						break;
// 					case 'updateBotCode':
// 						updateBotCode(message.id, message.codeId, message.code);
// 						break;
// 					case 'stopStream':
// 						document.getElementById('sendButton').textContent = 'Send';
// 						document.getElementById('sendButton').disabled = false;
// 						isStreaming = false;
// 						break;
// 				}
// 			});
// 		</script>
// 	</body>
// 	</html>`;
// }


// // This method is called when your extension is deactivated
// function deactivate() {}

// module.exports = {
// 	activate,
// 	deactivate
// }

const vscode = require('vscode');
const { Ollama } = require("@langchain/community/llms/ollama");
const pdfParse = require('pdf-parse');
const { exec } = require('child_process');
const { OpenAI } = require("openai");
const AbortController = require('abort-controller');

let selectedText = '';
let uploadedFileText = '';
let activeEditor = null;
let isGPT = false;
let currentStream = null;

let ollama = new Ollama({
    baseUrl: "http://localhost:11434", // Default value
    model: "phi3", // Default value
});

const openai = new OpenAI({
    apiKey: "sk-proj-M6ZLbZbpndRH2OSr87PKT3BlbkFJMAbUFWQUx1Wwe4vdZ1vy"
});
let abortController = new AbortController();

function activate(context) {
    console.log('Congratulations, your extension "code-assistant" is now active!');

    exec('ollama serve', (err, stdout, stderr) => {
        if (err) {
            console.error(`Error starting ollama serve: ${err}`);
            return;
        }
        console.log(`ollama serve output: ${stdout}`);
        console.error(`ollama serve error output: ${stderr}`);
    });

    vscode.window.onDidChangeTextEditorSelection(event => {
        const editor = event.textEditor;
        if (editor) {
            activeEditor = editor;
            const selection = editor.selection;
            selectedText = editor.document.getText(selection);
        }
    });

    let other = vscode.commands.registerCommand('code-assistant.openChat', function () {
        const panel = vscode.window.createWebviewPanel(
            'chatPanel',
            'Chat',
            vscode.ViewColumn.Beside,
            { enableScripts: true }
        );

        panel.webview.html = getWebviewContent("Hi there! Ask me anything");

        panel.webview.onDidReceiveMessage(async message => {
            if (message.command === 'sendInput') {
				let userInput = message.text;

				if (selectedText) {
					userInput = userInput + ". Here is the highlighted code: " + selectedText;
				}

				if(uploadedFileText) {
					userInput = userInput + ". Here is the relevant file: " + uploadedFileText;
				}
                await handleUserInput(panel, userInput);
            } else if (message.command === 'stopStream') {
                await stopStream(panel);
            } else if (message.command === 'uploadFile') {
                await handleFileUpload(message.file, message.fileName);
            } else if (message.command === 'changeModel') {
                await changeModel(message.model);
            }
        });

        context.subscriptions.push(other);
    });

    context.subscriptions.push(other);
}

async function handleUserInput(panel, userInput) {
    abortController = new AbortController();
	if(isGPT) {
		currentStream = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ "role": "user", content: userInput }],
            stream: true,
        });
	} else {
		currentStream = await ollama.stream(userInput, { signal: abortController.signal });
	}

	let codeMode = false;
	let codeId = null;
	let textId = "textId-" + Date.now();
	const messageId = Date.now(); // Unique identifier for the message

	panel.webview.postMessage({ command: 'startBotMessage', id: messageId });
	panel.webview.postMessage({ command: 'startBotText', id: messageId, textId: textId });

	for await (const chunk of currentStream) {
		if(isGPT) {
			chunk = chunk.choices[0].delta
		}
		
		if (chunk.includes("```")) {
			codeMode = !codeMode;
			if (codeMode) {
				codeId = "codeId-" + Date.now();
				panel.webview.postMessage({ command: 'startBotCode', id: messageId, codeId: codeId });
			} else {
				textId = "textId-" + Date.now();
				panel.webview.postMessage({ command: 'startBotText', id: messageId, textId: textId });
			}
			continue;
		}

		if (codeMode) {
			panel.webview.postMessage({ command: 'updateBotCode', id: messageId, codeId: codeId, code: chunk });
		} else {
			panel.webview.postMessage({ command: 'updateBotText', id: messageId, textId: textId, text: chunk });
		}
	}
	panel.webview.postMessage({ command: 'stopStream' });
}

async function handleGPT(panel, userInput) {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ "role": "user", content: userInput }],
            stream: true,
        });

        let codeMode = false;
		let codeId = null;
		let textId = "textId-" + Date.now();
		const messageId = Date.now(); // Unique identifier for the message

		panel.webview.postMessage({ command: 'startBotMessage', id: messageId });
		panel.webview.postMessage({ command: 'startBotText', id: messageId, textId: textId });

		for await (const chunk of response) {
			chunk = chunk.choices[0].delta
			if (chunk.includes("```")) {
				codeMode = !codeMode;
				if (codeMode) {
					codeId = "codeId-" + Date.now();
					panel.webview.postMessage({ command: 'startBotCode', id: messageId, codeId: codeId });
				} else {
					textId = "textId-" + Date.now();
					panel.webview.postMessage({ command: 'startBotText', id: messageId, textId: textId });
				}
				continue;
			}

			if (codeMode) {
				panel.webview.postMessage({ command: 'updateBotCode', id: messageId, codeId: codeId, code: chunk });
			} else {
				panel.webview.postMessage({ command: 'updateBotText', id: messageId, textId: textId, text: chunk });
			}
		}
    } catch (error) {
        console.error(`Error calling OpenAI API: ${error}`);
    }
}

async function handleOllama(panel, userInput) {
    
}

async function stopStream(panel) {
    if (currentStream && currentStream.return) {
        abortController.abort();
        await currentStream.return();
    }
	panel.webview.postMessage({ command: 'stopStream' });
}

async function handleFileUpload(file, fileName) {
    const fileContent = Buffer.from(file, 'base64');
    const data = await pdfParse(fileContent);
    uploadedFileText += data.text;
    console.log(uploadedFileText);
}

async function changeModel(selectedModel) {
    if (selectedModel == "GPT") {
        isGPT = true;
    } else {
        ollama = new Ollama({
            baseUrl: "http://localhost:11434",
            model: selectedModel,
        });
        isGPT = false;
    }
    console.log(`Switching to model: ${selectedModel}`);
    vscode.window.showInformationMessage(`Model changed to: ${selectedModel}`);
}

function getWebviewContent(information) {
	return `<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>Chat Interface</title>
		<style>
			body {
				font-family: Arial, sans-serif;
				margin: 0;
				padding: 0;
				display: flex;
				flex-direction: column;
				height: 100vh;
			}
			#header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px;
                border-bottom: 1px solid #ccc;
                box-sizing: border-box;
            }
            #modelSelect {
                padding: 10px;
                font-size: 12px;
                border: 1px solid #ccc;
                border-radius: 5px;
                outline: none;
            }
			#chatContainer {
				flex: 1;
				display: flex;
				flex-direction: column;
				padding: 10px;
				box-sizing: border-box;
				overflow-y: auto;
				border-bottom: 1px solid #ccc;
			}
			.message {
				margin-bottom: 10px;
				padding: 8px 12px;
				border-radius: 15px;
				max-width: 100%;
				color: black;
			}
			.userMessage {
				align-self: flex-end;
				background-color: #dcf8c6;
			}
			.botMessage {
				align-self: flex-start;
				background-color: #ececec;
			}
			#inputContainer {
				display: flex;
				padding: 10px;
				border-top: 1px solid #ccc;
				box-sizing: border-box;
			}
			#inputBox {
				flex: 1;
				padding: 10px;
				font-size: 16px;
				border: 1px solid #ccc;
				border-radius: 5px;
				outline: none;
			}
			#uploadButton {
				padding: 10px 20px;
				font-size: 16px;
				margin-left: 10px;
				border: none;
				background-color: #4CAF50;
				color: white;
				border-radius: 5px;
				cursor: pointer;
			}
			#uploadButton:hover {
				background-color: #45a049;
			}

			#sendButton {
				padding: 10px 20px;
				font-size: 16px;
				margin-left: 10px;
				border: none;
				background-color: #4CAF50;
				color: white;
				border-radius: 5px;
				cursor: pointer;
			}
			#sendButton:hover {
				background-color: #45a049;
			}
			/* Your existing CSS styles */
			#fileName.success::after {
				content: ' ✓';
				color: green;
				margin-left: 5px;
			}
			#fileName {
				margin-bottom: 10px;
				margin-left: 10px;
				margin-top: 10px;
				font-size: 15px /* Add margin-bottom to separate the file name from the input box */
			}
			pre {
				background: #000;
				color: #fff;
				border: none;
				padding: 0;
				overflow-x: auto;
			}
		
			pre code {
				display: block;
				font-family: 'Fira Code', monospace;
				font-size: 14px;
				line-height: 1.6;
				background: none;
				padding: 0;
			}
		
			.language-plaintext {
				color: #fff;
			}
		
			.language-javascript {
				color: #9cdcfe; /* Change to the appropriate color for JavaScript keywords */
			}
		
			.language-python {
				color: #4ec9b0; /* Change to the appropriate color for Python keywords */
			}
		</style>
	</head>
	<body>
		<div id="header">
            <div>Select Model:</div>
            <select id="modelSelect" onchange="changeModel()">
                <option value="phi3">phi3</option>
                <option value="llama2">llama2</option>
                <option value="codellama">codellama</option>
				<option value="GPT">GPT</option>
            </select>
        </div>
		<div id="chatContainer">
			<div class="message botMessage">${information}</div>
		</div>
		<div id="fileName"></div>
		<div id="inputContainer">
			<input type="text" id="inputBox" placeholder="Type your message here...">
			<button id="uploadButton" onclick="uploadFile()">Upload</button>
			<button id="sendButton" onclick="sendMessage()">Send</button>
		</div>
		<script>
			const vscode = acquireVsCodeApi();
			let isStreaming = false;

			function sendMessage() {
				const inputBox = document.getElementById('inputBox');
				const sendButton = document.getElementById('sendButton');

				if(isStreaming) {
					vscode.postMessage({
						command: 'stopStream'
					});
					sendButton.textContent = 'Send';
					sendButton.disabled = true;
					sendButton.style.backgroundColor = '#4CAF50';
				} else {
					const message = inputBox.value;
					if (message.trim()) {
						addMessageToChat(message, 'userMessage');
						vscode.postMessage({
							command: 'sendInput',
							text: message
						});
						inputBox.value = '';
						updateFileName('');
						sendButton.textContent = 'Stop';
						sendButton.style.backgroundColor = '#fc0f03';
						isStreaming = true;
					}
				}

			}

			function uploadFile() {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.pdf';
                input.onchange = async () => {
                    const file = input.files[0];
                    const reader = new FileReader();
                    reader.onload = () => {
                        const fileContent = reader.result.split(',')[1];
						const fileName = file.name;
                        vscode.postMessage({
                            command: 'uploadFile',
                            file: fileContent,
							fileName: fileName
                        });
						updateFileName(fileName);
                    };
                    reader.readAsDataURL(file);
                };
                input.click();
			}

			function updateFileName(fileName) {
				const fileNameElement = document.getElementById('fileName');

				if(fileName) {
					fileNameElement.textContent = fileName;
					fileNameElement.classList.add('success');
				} else {
					fileNameElement.textContent = '';
					fileNameElement.classList.remove('success');
				}
			}

			function addMessageToChat(message, className) {
				const chatContainer = document.getElementById('chatContainer');
				const messageElement = document.createElement('div');
				messageElement.className = 'message ' + className;
				messageElement.textContent = message;
				chatContainer.appendChild(messageElement);
				chatContainer.scrollTop = chatContainer.scrollHeight;
			}

			function startBotMessage(id) {
                const chatContainer = document.getElementById('chatContainer');
                const messageElement = document.createElement('div');
                messageElement.className = 'message botMessage';
                messageElement.id = 'botMessage-' + id;
                chatContainer.appendChild(messageElement);
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }

			function startBotText(id, textId) {
				const messageElement = document.getElementById('botMessage-' + id);
				const textElement = document.createElement('p');
				textElement.id = textId;
				messageElement.appendChild(textElement);
				
                const chatContainer = document.getElementById('chatContainer');
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }

			function updateBotText(id, textId, text) {
                const messageElement = document.getElementById('botMessage-' + id);
                if (messageElement) {
					const textElement = document.getElementById(textId);
                    textElement.textContent += text;
                    const chatContainer = document.getElementById('chatContainer');
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                }
            }


            function startBotCode(id, codeId) {
                const messageElement = document.getElementById('botMessage-' + id);
                const preElement = document.createElement('pre');
                const codeElement = document.createElement('code');
                codeElement.id = codeId;
                preElement.appendChild(codeElement);
                messageElement.appendChild(preElement);

                const chatContainer = document.getElementById('chatContainer');
                chatContainer.appendChild(messageElement);
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }

            function updateBotCode(id, codeId, code) {
				const messageElement = document.getElementById('botMessage-' + id);
				if (messageElement) {
					const codeElement = document.getElementById(codeId);
					codeElement.textContent += code;
					const chatContainer = document.getElementById('chatContainer');
					chatContainer.scrollTop = chatContainer.scrollHeight;
				}
			}
			function changeModel() {
                const modelSelect = document.getElementById('modelSelect');
                const selectedModel = modelSelect.value;
                vscode.postMessage({
                    command: 'changeModel',
                    model: selectedModel
                });
            }

			// Listen for messages from the extension
			window.addEventListener('message', event => {
				const message = event.data;
				switch (message.command) {
					case 'startBotMessage':
						startBotMessage(message.id);
						break;
					case 'startBotText':
						startBotText(message.id, message.textId);
						break;
					case 'updateBotText':
						updateBotText(message.id, message.textId, message.text);
						break;
					case 'startBotCode':
						startBotCode(message.id, message.codeId);
						break;
					case 'updateBotCode':
						updateBotCode(message.id, message.codeId, message.code);
						break;
					case 'stopStream':
						document.getElementById('sendButton').textContent = 'Send';
						document.getElementById('sendButton').disabled = false;
						isStreaming = false;
 						sendButton.style.backgroundColor = '#4CAF50';
						break;
				}
			});
		</script>
	</body>
	</html>`;
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
