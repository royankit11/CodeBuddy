const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, getDoc, getDocs, collection, deleteDoc} = require('firebase/firestore');

const firebaseConfig = {
	apiKey: "AIzaSyDJKHWvywSOFaIreT0LL6e6EXCULwF5bMg",
	authDomain: "spotifywrapped-45dcc.firebaseapp.com",
	projectId: "spotifywrapped-45dcc",
	storageBucket: "spotifywrapped-45dcc.appspot.com",
	messagingSenderId: "777226242233",
	appId: "1:777226242233:web:fe41a8c6bad67cb880b368",
	measurementId: "G-3V6CDJVD22"
  };

let app = initializeApp(firebaseConfig);
let firestoreDB = getFirestore();

const vscode = require('vscode');
const { Ollama } = require("@langchain/community/llms/ollama");
const pdfParse = require('pdf-parse');
const { exec } = require('child_process');
const { OpenAI } = require("openai");
const AbortController = require('abort-controller');
const { Pinecone } = require('@pinecone-database/pinecone');
const { OllamaEmbeddings } = require('@langchain/community/embeddings/ollama');

let selectedText = '';
let uploadedFileText = '';
let activeEditor = null;
let isGPT = false;
let currentStream = null;

let ollama = new Ollama({
    baseUrl: "http://localhost:11434", // Default value
    model: "phi3", // Default value
});

const embeddings = new OllamaEmbeddings({
	model: "phi3", // default value
	baseUrl: "http://localhost:11434", // default value
});
  
const openai = new OpenAI({
    apiKey: "sk-proj-M6ZLbZbpndRH2OSr87PKT3BlbkFJMAbUFWQUx1Wwe4vdZ1vy"
});
let abortController = new AbortController();


const pc = new Pinecone({
	apiKey: '9894c035-5130-48f8-9579-c9101ba21180', // Replace with your Pinecone API key
  });
const index = pc.index("llm-extension")

let uploadedFiles = [];


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

	vscode.workspace.onDidSaveTextDocument(async (document) => {
        const codebase = document.getText();
        const fileName = document.fileName;

        await storeCodebase(codebase, fileName);

        vscode.window.showInformationMessage('Codebase stored successfully!');
    });

    let openChatCommand = vscode.commands.registerCommand('code-assistant.openChat', async function () {
        const panel = vscode.window.createWebviewPanel(
            'chatPanel',
            'Chat',
            vscode.ViewColumn.Beside,
            { enableScripts: true }
        );

        panel.webview.html = getWebviewContent("Hi there! Ask me anything");

		//Loop through every doc in firebase DOCS collection and add to uploaded docs array
		try {
			const querySnapshot = await getDocs(collection(firestoreDB, "DOCS"));
			querySnapshot.forEach((doc) => {
				uploadedFiles.push(doc.id);
			});
		} catch (error) {
			console.error("Error fetching documents from Firestore:", error);
		}

		panel.webview.postMessage({
			command: 'updateFileList',
			files: uploadedFiles
		});

        panel.webview.onDidReceiveMessage(async message => {
            if (message.command === 'sendInput') {
				let userInput = message.text;

				const embeddedInput = await embeddings.embedQuery(userInput);
				const docResponse = await index.namespace('docs').query({
					vector: embeddedInput,
					topK: 1
				});

				const codeResponse = await index.namespace('code').query({
					vector: embeddedInput,
					topK: 1
				});

				let docMatches = docResponse.matches;
				let codeMatches = codeResponse.matches;


				if(docMatches[0]) {
					let docID = docMatches[0].id;
					let docScore = docMatches[0].score;
					console.log(docID);
					console.log(docScore);
					
					const docRef = doc(firestoreDB, "DOCS", docID);
					const docSnap = await getDoc(docRef);

					if (docSnap.exists()) {
						//userInput = userInput + ". Here are some files that might provide context. It may or may not be pertinent to the query but keep it in mind: "
						//+ docSnap.data().text;
						userInput = "Context: " + docSnap.data().text + ". Query: " + userInput;
					} 
				}

				if(codeMatches[0]) {
					let codeID = codeMatches[0].id;
					let codeScore = codeMatches[0].score;
					console.log(codeID);
					console.log(codeScore);
					
					const codeRef = doc(firestoreDB, "CODE", codeID);
					const codeSnap = await getDoc(codeRef);

					if (codeSnap.exists()) {
						//userInput = userInput + ". Here are some files that might provide context. It may or may not be pertinent to the query but keep it in mind: "
						//+ docSnap.data().text;
						userInput += ". Relevant Code: " + codeSnap.data().text;
					} 
				}

				console.log(userInput);



				if (selectedText) {
					userInput = userInput + ". Here is the highlighted code: " + selectedText;
				}

                await handleUserInput(panel, userInput);
            } else if (message.command === 'stopStream') {
                await stopStream(panel);
            } else if (message.command === 'uploadFile') {
                await handleFileUpload(panel, message.file, message.fileName);
            } else if (message.command === 'changeModel') {
                await changeModel(message.model);
            } else if (message.command === 'removeFile') {
				await removeFileFromDB(panel, message.index);				
			}
        });

        context.subscriptions.push(openChatCommand);
    });

    context.subscriptions.push(openChatCommand);
	context.subscriptions.push(
        vscode.languages.registerInlineCompletionItemProvider({ pattern: '**' }, new MyInlineCompletionItemProvider())
    );

}


class MyInlineCompletionItemProvider {
	constructor() {
        // Initialize a timer variable
        this.timer = null;
		this.latestPrompt = ''
		this.latestCompletion = '';
    }

    async provideInlineCompletionItems(document, position, context, token) {
		clearTimeout(this.timer);

		return new Promise((resolve) => {
            // Set a new timer for 2 seconds
            this.timer = setTimeout(async () => {
                try {
					vscode.window.setStatusBarMessage('Autocompleting...');
                    const text = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
					const language = document.languageId;
					console.log(language);
					if(text === this.latestPrompt) {
						let completionItem = new vscode.InlineCompletionItem(this.latestCompletion);
						completionItem.range = new vscode.Range(position, position);
						resolve(new vscode.InlineCompletionList([completionItem]));
					} else {
						this.latestPrompt = text;
						let completionText = '';
						const stream = await ollama.stream("Complete just this line of code. Language is " + language + ". Just code, no other text. " + 
						"Do not add triple quotes or the coding language. Don't write what I've already written." +
						"Here is the start of the line: " + text);
						
						for await (const chunk of stream) {
							completionText += chunk;
						}
						this.latestCompletion = completionText;

						let completionItem = new vscode.InlineCompletionItem(completionText);
						completionItem.range = new vscode.Range(position, position);

						// Resolve the promise with the completion item
						vscode.window.setStatusBarMessage('');
						resolve(new vscode.InlineCompletionList([completionItem]));
					}
                } catch (error) {
                    console.error("Error fetching completion:", error);
                    // Resolve with an empty completion list in case of an error
                    resolve(new vscode.InlineCompletionList([]));
                }
            }, 2000); // 2000 milliseconds = 2 seconds
        });
    }
}

async function handleUserInput(panel, userInput) {
	let codeMode = false;
	let codeId = null;
	let textId = "textId-" + Date.now();
	const messageId = Date.now(); // Unique identifier for the message

	panel.webview.postMessage({ command: 'startBotMessage', id: messageId });
	panel.webview.postMessage({ command: 'startBotText', id: messageId, textId: textId });

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

async function storeCodebase(codebase, fileName) {
    const lines = codebase.split('\n');
    const chunkSize = 20; // Number of lines per chunk
    let chunks = [];
    for (let i = 0; i < lines.length; i += chunkSize) {
        const chunk = lines.slice(i, i + chunkSize).join('\n');
        chunks.push({ text: chunk, index: Math.floor(i / chunkSize) });
    }

	fileName = fileName.split('/').pop();
	console.log(fileName);

    for (const chunk of chunks) {
        const chunkEmbeddings = await embeddings.embedQuery(chunk.text);
        await index.namespace('code').upsert([
            {
                id: `${fileName}-chunk-${chunk.index}`,
                values: chunkEmbeddings
            }
        ]);

        const chunkData = {
            text: chunk.text,
            index: chunk.index,
        };

        const document = doc(firestoreDB, "CODE", `${fileName}-chunk-${chunk.index}`);
        await setDoc(document, chunkData);
    }

    console.log("Codebase stored successfully.");
}

async function stopStream(panel) {
    if (currentStream && currentStream.return) {
        abortController.abort();
        await currentStream.return();
    }
	panel.webview.postMessage({ command: 'stopStream' });
}

async function handleFileUpload(panel, file, fileName) {
    const fileContent = Buffer.from(file, 'base64');

	panel.webview.postMessage({
        command: 'updateProgress',
        percent: '10%'
    });

    const data = await pdfParse(fileContent);
    uploadedFileText = data.text;

	panel.webview.postMessage({
        command: 'updateProgress',
        percent: '20%'
    });


	const documentEmbeddings = await embeddings.embedQuery(uploadedFileText)

	panel.webview.postMessage({
        command: 'updateProgress',
        percent: '40%'
    });

    await index.namespace('docs').upsert([
		{
		  id: fileName,
		  values: documentEmbeddings
		}
	])


	const fileData = {
		text: uploadedFileText,
	};

	panel.webview.postMessage({
        command: 'updateProgress',
        percent: '70%'
    });

	try {
		const document = doc(firestoreDB, "DOCS", fileName);
        let dataUpdated = await setDoc(document, fileData);
        console.log("Document written successfully to Firestore.");
    } catch (error) {
        console.error("Error writing document to Firestore:", error);
    }

	panel.webview.postMessage({
        command: 'updateProgress',
        percent: '100%'
    });

	uploadedFiles.push(fileName); // Add the filename to the array
    panel.webview.postMessage({
        command: 'updateFileList',
        files: uploadedFiles
    });
	
}

async function removeFileFromDB(panel, ind) {
	let file = uploadedFiles[ind];
	uploadedFiles.splice(ind, 1); // Remove the file from the array
	panel.webview.postMessage({
		command: 'updateFileList',
		files: uploadedFiles
	});

	await index.namespace('docs').deleteOne(file);

	try {
        const docRef = doc(firestoreDB, "DOCS", file);
        await deleteDoc(docRef);
        console.log("Document successfully deleted from Firestore.");
    } catch (error) {
        console.error("Error deleting document:", error);
    }

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
			#fileNameList {
                margin-bottom: 10px;
				margin-left: 10px;
				margin-top: 10px;
				font-size: 15px
            }
			.file-item {
				display: flex;
				justify-content: space-between;
				align-items: center;
				padding: 5px;
				border: 1px solid #ccc;
				margin-bottom: 5px;
			}
			.remove-btn {
				background: red;
				color: white;
				border: none;
				cursor: pointer;
			}
			#progressBarContainer {
				width: 100%;
				height: 20px;
				background-color: #f0f0f0;
				border-radius: 5px;
				margin-top: 10px;
			}
			
			#progressBar {
				width: 0%;
				height: 100%;
				background-color: #4CAF50;
				border-radius: 5px;
				transition: width 0.3s ease-in-out; /* Transition effect for width changes */
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
		<div id="fileNameList"></div>
		<div id="progressBarContainer">
            <div id="progressBar"></div>
        </div>
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
                    fileItem.textContent = fileName;
					
					const removeButton = document.createElement('button');
					removeButton.textContent = 'x';
					removeButton.classList.add('remove-btn');
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
				textElement.textContent = "Responding...";
				messageElement.appendChild(textElement);
				
                const chatContainer = document.getElementById('chatContainer');
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }

			function updateBotText(id, textId, text) {
                const messageElement = document.getElementById('botMessage-' + id);
                if (messageElement) {
					const textElement = document.getElementById(textId);
					if(textElement.textContent === "Responding...") {
						textElement.textContent = text;
					} else {
						textElement.textContent += text;
					}

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
			function updateProgress(progress) {
                const progressBar = document.getElementById('progressBar');
                progressBar.style.width = progress;
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
					case 'updateFileList':
						const { files } = message;
						updateFileList(files);
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
					case 'updateProgress':
						updateProgress(message.percent);
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
