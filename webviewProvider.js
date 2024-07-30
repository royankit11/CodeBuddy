const vscode = require('vscode');

class ChatViewProvider {
    constructor(context) {
        this._context = context;
        this._view = null;
    }

    resolveWebviewView(webviewView, context, token) {
		console.log('Resolving webview view');
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            retainContextWhenHidden: true
        };

        webviewView.webview.html = this.getWebviewContent();
    }

    getWebviewContent() {
        return `<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>Code Buddy</title>
		<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
		<link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.24.1/themes/prism-tomorrow.min.css" rel="stylesheet" />
		<link href="https://fonts.googleapis.com/css2?family=Ubuntu:ital,wght@0,300;0,400;0,500;0,700;1,300;1,400;1,500;1,700&display=swap" rel="stylesheet">
		<style>
			body {
				font-family: 'Ubuntu', sans-serif;
				margin: 0;
				padding: 0;
				display: flex;
				flex-direction: column;
				height: 100vh;
			}
			#header {
                display: flex;
				justify-content: flex-end;
                align-items: center;
                padding: 10px;
                border-bottom: 1px solid #ccc;
                box-sizing: border-box;
            }
			#installButtonContainer {
				margin-right: 10px;
			}
            #modelSelect {
                padding: 10px;
                font-size: 15px;
				background-color: #262525;
				color: white;
                border-radius: 5px;
            }
			.installButton {
				padding: 10px;
				font-size: 13px;
				background-color: #1886d9;
				color: white;
				border-radius: 5px;
				border: none; /* Remove default button border */
				cursor: pointer; /* Change cursor to pointer on hover */
				transition: background-color 0.3s, box-shadow 0.3s; /* Smooth transition */
			}
			.installButton:hover {
				background-color: #0066cc; /* Darker shade of blue on hover */
				box-shadow: 0 0 5px rgba(0, 0, 0, 0.3); /* Add shadow on hover */
			}
			.removeModelButton {
				padding: 10px;
				font-size: 13px;
				background-color: transparent;
				color: #fc2830;
				border-radius: 5px;
				border: 1px solid #fc2830; /* Remove default button border */
				cursor: pointer; /* Change cursor to pointer on hover */
				transition: background-color 0.3s, box-shadow 0.3s; /* Smooth transition */
			}
			.removeModelButton:hover {
				background-color: #fc2830; /* Darker shade of blue on hover */
				color: white;
				box-shadow: 0 0 5px rgba(0, 0, 0, 0.3); /* Add shadow on hover */
			}
			#chatContainer {
				flex: 1;
				display: flex;
				flex-direction: column;
				box-sizing: border-box;
				overflow-y: auto;
			}

			.icon-tag-container {
				display: flex;
				align-items: center;
				margin-bottom: 5px; /* Adjust as needed */
			}
			
			.user-icon {
				margin-right: 8px; /* Space between icon and tag */
				font-size: 20px; /* Adjust size as needed */
				color: #838ef2;
			}

			.llm-icon {
				margin-right: 8px; /* Space between icon and tag */
				font-size: 20px; /* Adjust size as needed */
				color: #98FB98;
			}

			.message {
				padding: 10px 12px;
				max-width: 100%;
				width: 95%;
				color: black;
				border-bottom: 1px solid #ccc;
			}

			.horizontal-line {
				border: none;
				height: 1px;
				background-color: #ccc;
				width: 100%; /* Set the width to 100% */
				margin-top: 5px; /* Adjust margin top as needed */
				margin-bottom: 5px; /* Adjust margin bottom as needed */
			}

			.userMessage {
				align-self: flex-start;
				background-color: transparent;
				color: white;
				font-size: 15px;
			}
			.botMessage {
				align-self: flex-start;
				background-color: #262525;
				color: white;
				font-size: 15px;
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
				font-size: 14px;
				border: none;
				border-radius: 15px;
				background-color:  #4e5054;
				color: white;
				outline: none;
				resize: none; /* Prevent resizing */
				overflow: hidden;
				overflow-wrap: break-word; /* Ensure text wraps to the next line */
				white-space: pre-wrap; /* Preserve whitespace and wrap text */
				height: 20px; /* Set height to auto */
				min-height: 20px; /* Set a minimum height */
				max-height: 100px; /* Set a maximum height */
				width: 100%;
				line-height: 1.5em;
			}
			#uploadButton {
				padding: 5px 5px;
				font-size: 16px;
				margin-right: 10px;
				border: none;
				color: white;
				border-radius: 5px;
				cursor: pointer;
				background-color: transparent;
			}
			#uploadButton:hover {
				color: #4e5054;
			}
			#sendButton {
				padding: 10px 10px;
				font-size: 20px;
				margin-left: 10px;
				border: none;
				background-color: transparent;
				color: white;
				border-radius: 5px;
				cursor: pointer;
			}
			#sendButton:hover {
				color: #4e5054;
			}
			#fileNameList {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				padding: 5px;
				border-radius: 5px;
				margin: 10px 0;
			}
		
			.file-item {
				display: flex;
				align-items: center;
				justify-content: space-between;
				margin-right: 10px;
				padding: 7px;
				background-color: transparent;
				border: 1px solid #ccc;
				border-radius: 5px;
				position: relative;
			}
		
			.file-item-icon {
				font-size: 18px;
				margin-right: 5px;
			}
		
			.file-item-name {
				margin-right: 5px;
			}

			.llm-tag {
				font-size: 16px;
				color: #ccc;
				font-weight: bold;
				margin-top: 10px;
				margin-bottom: 5px;
			}

			.user-tag {
				font-size: 16px;
				color: #ccc;
				font-weight: bold;
				margin-top: 10px;
				margin-bottom: 10px;
			}
		
			.remove-btn {
				background: black;
				color: white;
				border: none;
				border-radius: 50%;
				border: 1px solid #ccc;
				cursor: pointer;
				padding: 5px;
				font-size: 8px;
				position: absolute; /* Position absolute to remove it from the normal flow */
				top: -10px; /* Adjust top position */
				right: -10px;
				width: 8px; /* Set width equal to height */
    			height: 8px;
				display: flex; /* Use flexbox */
				justify-content: center; /* Center horizontally */
				align-items: center;
			}
			#progressBarContainer {
				width: 100%;
				height: 20px;
				background-color: #f0f0f0;
				border-radius: 5px;
				margin-top: 10px;
				display: none;
			}
			
			#progressBar {
				width: 0%;
				height: 100%;
				background-color: #4CAF50;
				border-radius: 5px;
				transition: width 0.3s ease-in-out; /* Transition effect for width changes */
			}
			pre {
				border-radius: 8px;
			}

			.copy-button {
				position: absolute;
				top: 8px;
				right: 8px;
				padding: 5px 10px;
				font-size: 12px;
				background-color: #1886d9;
				color: white;
				border: none;
				border-radius: 5px;
				cursor: pointer;
				transition: background-color 0.3s;
			}

			.copy-button:hover {
				background-color: #0066cc;
			}

			.insert-button {
				position: absolute;
				top: 8px;
				left: 10px;
				padding: 5px 10px;
				font-size: 12px;
				background-color: #4CAF50;
				color: white;
				border: none;
				border-radius: 5px;
				cursor: pointer;
				transition: background-color 0.3s;
			}

			.insert-button:hover {
				background-color: #45a049;
			}

			.line-number {
				position: absolute;
				top: 8px;
				left: 120px;
				padding: 2px;
				font-size: 12px;
				border: 1px solid #ccc;
				border-radius: 5px;
				height: 18px;
				width: 40px;
			}

			.pre-container {
				position: relative;
				border-radius: 8px;
				color: black;
			}
		</style>
	</head>
	<body>
		<div id="header">
			<div style="display: flex; align-items: center; margin-right: auto;">
				<input type="checkbox" id="useMessageHistory" name="contextCheckbox" style="margin-right: 5px;">
				<label for="contextCheckbox" style="color: white;">Use message history?</label>
			</div>
			<div id="installButtonContainer" style="margin-right: 10px;"></div>
		 	<select id="modelSelect" onchange="changeModel()">
				<option value="code-buddy">code-buddy</option>
                <option value="phi3">phi3</option>
				<option value="granite-code">granite-code</option>
                <option value="llama2">llama2</option>
				<option value="llama3">llama3</option>
                <option value="codellama">codellama</option>
            </select>
        </div>
		<div id="chatContainer">
		</div>
		<div id="fileNameList"></div>
		<div id="progressBarContainer">
            <div id="progressBar"></div>
        </div>
		<div id="inputContainer">
			<button id="uploadButton" onclick="uploadFile()"><i class="fas fa-paperclip"></i></button>
			<textarea id="inputBox" placeholder="Ask Code Buddy a question..."></textarea>
			<button id="sendButton" onclick="sendMessage()">
				<i class="fas fa-arrow-right" id="sendIcon"></i>
				<i class="fas fa-stop" id="stopIcon" style="display: none;"></i>
			</button>
		</div>
		<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.24.1/prism.min.js"></script>
		<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.24.1/components/prism-java.min.js"></script>
		<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/9000.0.1/components/prism-python.min.js"></script>
		<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/9000.0.1/components/prism-java.min.js"></script>
		<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.24.1/components/prism-javascript.min.js"></script>
		<script>
			const vscode = acquireVsCodeApi();
			let isStreaming = false;

			document.addEventListener('DOMContentLoaded', (event) => {
				const inputBox = document.getElementById('inputBox');
			
				inputBox.addEventListener('input', function() {
					// Set the height according to the scroll height, but not more than the max-height

					if(this.value.length > 50) {
						this.style.height = 'auto';
						this.style.overflow = 'auto';
						this.style.height = Math.min(this.scrollHeight, 100) + 'px';
					} else {
						this.style.height = '20px';
						this.style.overflow = 'hidden';
					}
				});

				inputBox.addEventListener('keydown', function(event) {
					if (event.key === 'Enter' && !event.shiftKey) {
						event.preventDefault(); // Prevent the default action (new line in textarea)
						sendMessage(); // Call the sendMessage function
					}
				});
			});


			function sendMessage() {
				const inputBox = document.getElementById('inputBox');
				const sendButton = document.getElementById('sendButton');
				const sendIcon = document.getElementById('sendIcon');
				const stopIcon = document.getElementById('stopIcon');
				const useMessageHistory = document.getElementById('useMessageHistory').checked;

				if(isStreaming) {
					vscode.postMessage({
						command: 'stopStream'
					});
					sendIcon.style.display = 'inline';
					stopIcon.style.display = 'none';
					sendButton.disabled = true;
				} else {
					const message = inputBox.value;
					if (message.trim()) {
						addMessageToChat(message, 'userMessage');
						vscode.postMessage({
							command: 'sendInput',
							text: message,
							useMessageHistory: useMessageHistory
						});
						inputBox.value = '';
						sendIcon.style.display = 'none';
						stopIcon.style.display = 'inline';
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
						showProgressBar();
                        vscode.postMessage({
                            command: 'uploadFile',
                            file: fileContent,
							fileName: fileName
                        });
						//updateFileName(fileName);
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

			function updateFileList(fileNames) {
                const fileNameListElement = document.getElementById('fileNameList');
                fileNameListElement.innerHTML = '';
				var index = 0;
                fileNames.forEach(fileName => {
                    const fileItem = document.createElement('div');
					fileItem.classList.add('file-item');

					const icon = document.createElement('i');
					icon.classList.add('fas', 'fa-file-lines', 'file-item-icon');
					fileItem.appendChild(icon);
					const fileNameElement = document.createElement('span');
					fileNameElement.textContent = fileName;
					fileNameElement.classList.add('file-item-name');
					fileItem.appendChild(fileNameElement);
					
					const removeButton = document.createElement('i');
					removeButton.classList.add('fas', 'fa-x', 'remove-btn');
					removeButton.onclick = (() => {
						const currentIndex = index; // Capture the current index value in a closure
						return () => vscode.postMessage({ command: 'removeFile', index: currentIndex });
					})();
					index += 1;
					fileItem.appendChild(removeButton);			
                    fileNameListElement.appendChild(fileItem);
                });
            }

			function removeFile(index) {
				vscode.postMessage({ command: 'removeFile', index: index});
			}

			function addMessageToChat(message, className) {
				const chatContainer = document.getElementById('chatContainer');
				const messageElement = document.createElement('div');
				messageElement.className = 'message ' + className;

				const iconTagContainer = document.createElement('div');
    			iconTagContainer.className = 'icon-tag-container';

				const icon = document.createElement('i');
				icon.classList.add('fas', 'fa-user-circle', 'user-icon');
				iconTagContainer.appendChild(icon);

			
				const userTag = document.createElement('div');
				userTag.textContent = 'User';
				userTag.className = 'user-tag';
				iconTagContainer.appendChild(userTag);

				messageElement.appendChild(iconTagContainer);

				const messageContent = document.createElement('div');
				messageContent.textContent = message; // Set the message content separately
				messageElement.appendChild(messageContent);

				chatContainer.appendChild(messageElement);
				chatContainer.scrollTop = chatContainer.scrollHeight;
			}

			function startBotMessage(id, llmModel) {
                const chatContainer = document.getElementById('chatContainer');
                const messageElement = document.createElement('div');
                messageElement.className = 'message botMessage';

				const iconTagContainer = document.createElement('div');
    			iconTagContainer.className = 'icon-tag-container';

				const icon = document.createElement('i');
				icon.classList.add('fas', 'fa-robot', 'llm-icon');
				iconTagContainer.appendChild(icon);

				
				const llmTag = document.createElement('div');
				llmTag.textContent = llmModel;
				llmTag.className = 'llm-tag';
				iconTagContainer.appendChild(llmTag);

				messageElement.appendChild(iconTagContainer);

                messageElement.id = 'botMessage-' + id;
                chatContainer.appendChild(messageElement);
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }

			function startBotText(id, textId) {
				const messageElement = document.getElementById('botMessage-' + id);
				const textElement = document.createElement('p');
				textElement.id = textId;
				textElement.textContent = "Responding...";
				messageElement.appendChild(textElement);
				
                const chatContainer = document.getElementById('chatContainer');
                if(chatContainer.scrollHeight - chatContainer.scrollTop <= chatContainer.clientHeight + 20) {
					chatContainer.scrollTop = chatContainer.scrollHeight;
				}
            }

			function updateBotText(id, textId, text) {
                const messageElement = document.getElementById('botMessage-' + id);
                if (messageElement) {
					const textElement = document.getElementById(textId);

					if(textElement.textContent === "Responding...") {
						textElement.innerHTML = text;
					} else {
						textElement.innerHTML += text;
					}

                    const chatContainer = document.getElementById('chatContainer');
					if(chatContainer.scrollHeight - chatContainer.scrollTop <= chatContainer.clientHeight + 20) {
						chatContainer.scrollTop = chatContainer.scrollHeight;
					}
                }
            }


            function startBotCode(id, codeId, language) {
                const messageElement = document.getElementById('botMessage-' + id);

				const preContainer = document.createElement('div');
				preContainer.className = 'pre-container';

				const insertButton = document.createElement('button');
				insertButton.className = 'insert-button';
				insertButton.textContent = 'Insert at Line #';
				insertButton.onclick = function() {
					const lineNumber = document.getElementById('line-number-input-' + codeId).value;
					const codeToInsert = document.getElementById(codeId).textContent;
					vscode.postMessage({
						command: 'insertCodeAtLine',
						code: codeToInsert,
						lineNumber: lineNumber
					});
				};
				preContainer.appendChild(insertButton);

				const lineNumberInput = document.createElement('input');
				lineNumberInput.type = 'number';
				lineNumberInput.id = 'line-number-input-' + codeId; // Unique ID for each input
				lineNumberInput.className = 'line-number';
				lineNumberInput.placeholder = '5';
				preContainer.appendChild(lineNumberInput);

				const copyButton = document.createElement('button');
				copyButton.className = 'copy-button';
				copyButton.textContent = 'Copy Code';
				copyButton.onclick = function() {
					copyCodeToClipboard(codeId);
					copyButton.textContent = 'Copied!';
					setTimeout(function() {
						copyButton.textContent = 'Copy Code';
					}, 1500); // Revert back to 'Copy Code' after 1.5 seconds
				};
				preContainer.appendChild(copyButton);

                const preElement = document.createElement('pre');
                const codeElement = document.createElement('code');
                codeElement.id = codeId;
				codeElement.className = 'language-' + language;
				codeElement.innerHTML = '<br></br>' + codeElement.innerHTML;
                preElement.appendChild(codeElement);
				preContainer.appendChild(preElement);
                messageElement.appendChild(preContainer);

                const chatContainer = document.getElementById('chatContainer');
                chatContainer.appendChild(messageElement);
                if(chatContainer.scrollHeight - chatContainer.scrollTop <= chatContainer.clientHeight + 20) {
					chatContainer.scrollTop = chatContainer.scrollHeight;
				}
            }

            function updateBotCode(id, codeId, code) {
				const messageElement = document.getElementById('botMessage-' + id);
				if (messageElement) {
					const codeElement = document.getElementById(codeId);
					codeElement.textContent += code;
					Prism.highlightElement(codeElement);
					const chatContainer = document.getElementById('chatContainer');
					if(chatContainer.scrollHeight - chatContainer.scrollTop <= chatContainer.clientHeight + 20) {
						chatContainer.scrollTop = chatContainer.scrollHeight;
					}
				}
			}
			function copyCodeToClipboard(codeId) {
				const codeElement = document.getElementById(codeId);
				const range = document.createRange();
				range.selectNodeContents(codeElement);
				const selection = window.getSelection();
				selection.removeAllRanges();
				selection.addRange(range);
				document.execCommand('copy');
				selection.removeAllRanges(); // Deselect the text
			}


			function changeModel() {
                const modelSelect = document.getElementById('modelSelect');
                const selectedModel = modelSelect.value;
                vscode.postMessage({
                    command: 'changeModel',
                    model: selectedModel
                });
            }
			function updateProgress(progress) {
                const progressBar = document.getElementById('progressBar');
                progressBar.style.width = progress;
				if (progress === '100%') {
					setTimeout(() => {
						hideProgressBar(); // Hide progress bar when upload completes
					}, 500); // Allow some time for the user to see 100% completion
				}
            }

			function showProgressBar() {
				document.getElementById('progressBarContainer').style.display = 'block';
			}
			
			function hideProgressBar() {
				document.getElementById('progressBarContainer').style.display = 'none';
			}

			function showInstallButton(visible, model) {
			 	const installButtonContainer = document.getElementById('installButtonContainer');
                installButtonContainer.innerHTML = ''; // Clear any existing content
				
				if(visible) {
					const installButton = document.createElement('button');
					installButton.textContent = 'Install';
					installButton.className = "installButton";

					installButton.onclick = function() {
						showProgressBar();
						vscode.postMessage({
							command: 'installModel',
							model: model
						});
						installButton.textContent = 'Installing...';
						installButton.style.backgroundColor = '#0e8032';
					};

					installButtonContainer.appendChild(installButton);
				} else {
					const removeModelButton = document.createElement('button');
					removeModelButton.textContent = 'Uninstall';
					removeModelButton.className = "removeModelButton";

					removeModelButton.onclick = function() {
						vscode.postMessage({
							command: 'removeModel',
							model: model
						});
					};

					installButtonContainer.appendChild(removeModelButton);
				}
			}

			function shortcutCommand(text) {
				const message = text;
				if (message.trim()) {
					addMessageToChat(message, 'userMessage');
					vscode.postMessage({
						command: 'sendInput',
						text: message,
						useMessageHistory: false
					});
					sendIcon.style.display = 'none';
					stopIcon.style.display = 'inline';
					isStreaming = true;
				}

			}

			// Listen for messages from the extension
			window.addEventListener('message', event => {
				const message = event.data;
				switch (message.command) {
					case 'startBotMessage':
						startBotMessage(message.id, message.llmModel);
						break;
					case 'startBotText':
						startBotText(message.id, message.textId);
						break;
					case 'updateBotText':
						updateBotText(message.id, message.textId, message.text);
						break;
					case 'updateFileList':
						const { files } = message;
						updateFileList(files);
						break;
					case 'startBotCode':
						startBotCode(message.id, message.codeId, message.language);
						break;
					case 'updateBotCode':
						updateBotCode(message.id, message.codeId, message.code);
						break;
					case 'stopStream':
						sendIcon.style.display = 'inline';
						stopIcon.style.display = 'none';
						document.getElementById('sendButton').disabled = false;
						isStreaming = false;
						break;
					case 'updateProgress':
						updateProgress(message.percent);
						break;
					case 'showInstallButton':
						showInstallButton(message.visible, message.model);
						break;
					case 'shortcutCommand':
						shortcutCommand(message.text);
						break;
				}
			});
		</script>
	</body>
	</html>`;
    }
}

module.exports = ChatViewProvider;