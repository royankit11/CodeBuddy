// The module 'vscode' contains the VS Code extensibility API

// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const { Ollama } = require("@langchain/community/llms/ollama");

let selectedText = '';
let activeEditor = null;


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "code-assistant" is now active!');

	const ollama = new Ollama({
		baseUrl: "http://localhost:11434", // Default value
		model: "phi3", // Default value
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
        // Create and show a new panel
        const panel = vscode.window.createWebviewPanel(
            'chatPanel',
            'Chat',
            vscode.ViewColumn.Beside,
            {
				enableScripts: true
			  }
        );

		const updateWebview = (information) => {
			panel.webview.html = getWebviewContent(information);
		  };

      panel.webview.html = getWebviewContent("Hi there! Ask me anything");

	  panel.webview.onDidReceiveMessage(
		async message => {
			if (message.command === 'sendInput') {
				
				let userInput = message.text;

				if (selectedText) {
					userInput = userInput + ". Here is the highlighted code: " + selectedText;
				}

				console.log(userInput);

				const stream = await ollama.stream(userInput);

				const messageId = Date.now(); // Unique identifier for the message

				panel.webview.postMessage({ command: 'startBotMessage', id: messageId });

				let codeMode = false;
				let codeId = null;
				let textId = "textId-" + Date.now();
				panel.webview.postMessage({ command: 'startBotText', id: messageId, textId: textId });

				for await (const chunk of stream) {
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
				
				// const result = chunks.join("");
				// vscode.window.showInformationMessage(result);
				// updateWebview(result);
			}
		},
		undefined,
		context.subscriptions
		);
    });

	context.subscriptions.push(other);
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
		<div id="chatContainer">
			<div class="message botMessage">${information}</div>
		</div>
		<div id="inputContainer">
			<input type="text" id="inputBox" placeholder="Type your message here...">
			<button id="sendButton" onclick="sendMessage()">Send</button>
		</div>
		<script>
			const vscode = acquireVsCodeApi();

			function sendMessage() {
				const inputBox = document.getElementById('inputBox');
				const message = inputBox.value;
				if (message.trim()) {
					addMessageToChat(message, 'userMessage');
					vscode.postMessage({
						command: 'sendInput',
						text: message
					});
					inputBox.value = '';
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

				}
			});
		</script>
	</body>
	</html>`;
}


// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
