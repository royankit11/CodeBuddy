//Import all libraries
const vscode = require('vscode');
const { Ollama } = require("@langchain/community/llms/ollama");
const debounce = require('lodash.debounce');
const pdfParse = require('pdf-parse');
const { exec , spawn } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const { OpenAI } = require("openai");
const AbortController = require('abort-controller');
const { Pinecone } = require('@pinecone-database/pinecone');
const { OllamaEmbeddings } = require('@langchain/community/embeddings/ollama');
const { Client } = require('pg');	
const {RecursiveCharacterTextSplitter} = require('langchain/text_splitter')
const { ChromaClient } = require("chromadb");
const fs = require('fs').promises;
const path = require('path');

//Declare global variables
let installedModels = [];
let messageHistory = [];
let selectedText = '';
let uploadedFileText = '';
let activeEditor = null;
let isGPT = false;
let currentStream = null;
let uploadedFiles = [];
const chroma = new ChromaClient();
let docsCollection;
let codebaseCollection;
let messageHistoryCollection;

let userQuery = '';
let llmResponse = '';

//Instatiate Ollama model
let ollama = new Ollama({
    baseUrl: "http://localhost:11434", // Default value
    model: "code-buddy", // Default value
});

const openai = new OpenAI({
    apiKey: "sk-proj-M6ZLbZbpndRH2OSr87PKT3BlbkFJMAbUFWQUx1Wwe4vdZ1vy"
});

//Create abort controller, used to stop LLMs from generating
let abortController = new AbortController();


//Instatiate Postgres DB
const client = new Client({
	host: 'localhost',
	port: 5433, // Default port for PostgreSQL
	user: 'postgres', // Replace with your PostgreSQL username
	password: 'testing', // Replace with your PostgreSQL password
	database: 'postgres' // Replace with your PostgreSQL database name
  });


/****************************************************************************
 * Code Completion Engine
 ****************************************************************************/
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

					//Get the text from the start to the cursor
                    const startText = document.getText(new vscode.Range(new vscode.Position(0, 0), position));

					//Get the text from the cursor to the end
					const endText = document.getText(new vscode.Range(position, new vscode.Position(document.lineCount, 0)));
					
					//Get the programming language
					const language = document.languageId;
					
					//If the prompt is the same as the last one, return the same completion
					if(startText === this.latestPrompt) {
						let completionItem = new vscode.InlineCompletionItem(this.latestCompletion);
						completionItem.range = new vscode.Range(position, position);
						resolve(new vscode.InlineCompletionList([completionItem]));
					} else {
						this.latestPrompt = startText;
						let completionText = '';
						abortController = new AbortController();
						// const query = `Complete the following code snippet in ${language}. ` + 
						// `Only provide the code continuation, no additional explanations or comments.` +
						// `Do NOT repeat any part of the provided code snippet. ` +
						// `Code before cursor:\n${startText}` + 
						// `Code after cursor:\n${endText}`;

						//const query = `Complete the code. Language is ${language}. Code before cursor: \n${startText}. Code after cursor: \n${endText}`
						const query = `Complete the code. Language is ${language}: ${startText}`

						console.log("Query:", query);

						let stream = await ollama.stream(query, { signal: abortController.signal });
						
						for await (const chunk of stream) {
							completionText += chunk;
							console.log(chunk);
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




/****************************************************************************
 * Extension Activation
 ****************************************************************************/
 function activate(context) {
    console.log('Congratulations, your extension "code-assistant" is now active!');

	//Connect to the Postgres DB
	client.connect()
		.then(() => {
			console.log('Connected to the database successfully!');
		})
		.catch(err => {
			console.error('Connection error', err.stack);
		});

	//Start the Ollama server
    exec('ollama serve', (err, stdout, stderr) => {
        if (err) {
            console.error(`Error starting ollama serve: ${err}`);
            return;
        }
        console.log(`ollama serve output: ${stdout}`);
        console.error(`ollama serve error output: ${stderr}`);
    });


	//Check if any text has been selected	
    vscode.window.onDidChangeTextEditorSelection(event => {
        const editor = event.textEditor;
        if (editor) {
            activeEditor = editor;
            const selection = editor.selection;
            selectedText = editor.document.getText(selection);
        }
    });

	//Check if file was saved so that code can be stored in the DB
	vscode.workspace.onDidSaveTextDocument(async (document) => {
        const codebase = document.getText();
        const fileName = document.fileName;

        await storeCodebase(codebase, fileName);

		vscode.window.setStatusBarMessage('Codebase stored successfully!');
    });

	//Register the command to open the chat window
    let openChatCommand = vscode.commands.registerCommand('code-assistant.codeBuddy', async function () {
        const panel = vscode.window.createWebviewPanel(
            'chatPanel',
            'Code Buddy',
            vscode.ViewColumn.Beside,
            { enableScripts: true }
        );		

		//Check if Chroma Docker is running
		try {
			await checkChromaContainer();
			const myTimeout = setTimeout(createCollections, 2000);

		} catch (error) {
			console.error('Error setting up Chroma collections:', error);
		}

		//Load the webview content and send the initial message
        panel.webview.html = getWebviewContent();
		panel.webview.postMessage({ command: 'startBotMessage', id: "first" , llmModel: ollama.model});
		panel.webview.postMessage({ command: 'startBotText', id: "first", textId: "first" });
		panel.webview.postMessage({ command: 'updateBotText', id: "first", textId: "first", text: "Hi there, ask me anything!"});

		//Get the list of uploaded files and display in the webview
		uploadedFiles = await getFileNamesFromDocs();
		panel.webview.postMessage({
			command: 'updateFileList',
			files: uploadedFiles
		});

		//Get the list of installed models and display in the webview
		exec('ollama list', (err, stdout, stderr) => {
			if (err) {
				console.error(`Error listing ollama models: ${err}`);
				return;
			}
			const lines = stdout.split('\n');
	
			// Remove the header line and any empty lines
			const modelLines = lines.slice(1).filter(line => line.trim() !== '');
	
			// Extract the model names
			installedModels = modelLines.map(line => line.split(/\s+/)[0].split(':')[0]);
	
			//Set default model to code-buddy
			console.log(`Ollama models: ${installedModels}`);
			if(installedModels.includes("code-buddy")) {
				panel.webview.postMessage({
					command: 'showInstallButton',
					visible: false,
					model: "code-buddy"
				});
			} else {
				panel.webview.postMessage({
					command: 'showInstallButton',
					visible: true,
					model: "code-buddy"
				});
			}
	
		});

		//Handle messages from the webview and redirect to appropriate functions
        panel.webview.onDidReceiveMessage(async message => {
            if (message.command === 'sendInput') {
				if(!installedModels.includes(ollama.model)) {
					vscode.window.showInformationMessage('Current model is not installed');
					panel.webview.postMessage({ command: 'stopStream' });
					return;
				}
                await handleUserInput(panel, message.text);
            } else if (message.command === 'stopStream') {
                await stopStream(panel);
            } else if (message.command === 'uploadFile') {
                await handleFileUpload(panel, message.file, message.fileName);
            } else if (message.command === 'changeModel') {
                await changeModel(panel, message.model);
            } else if (message.command === 'removeFile') {
				await removeFileFromDB(panel, message.index);				
			} else if (message.command === 'installModel') {
				installModel(panel, message.model);
			} else if (message.command === 'removeModel') {
				removeModel(panel, message.model);
			}
        });
    });

    context.subscriptions.push(openChatCommand);
	context.subscriptions.push(
        vscode.languages.registerInlineCompletionItemProvider({ pattern: '**' }, new MyInlineCompletionItemProvider())
    );

}

/****************************************************************************
 * Handling User Input and LLM Output
 ****************************************************************************/

//Handle user input and get LLM output
async function handleUserInput(panel, userInput) {
	abortController.abort();
	vscode.window.setStatusBarMessage('');
	//Convert the user input to vector
	let finalQuery = "";
	userQuery = userInput;
	try {
		if (selectedText) {
			finalQuery = userInput + ". Here is the highlighted code: " + selectedText;
		} else {
			//Query the vector DB for the most similar document and code
			const docResults = await docsCollection.query({
				queryTexts: [userInput], // Chroma will embed this for you
				nResults: 5, // how many results to return
			});

			const codeResults = await codebaseCollection.query({
				queryTexts: [userInput], // Chroma will embed this for you
				nResults: 5, // how many results to return
			});

			const messageResults = await messageHistoryCollection.query({
				queryTexts: [userInput], // Chroma will embed this for you
				nResults: 5, // how many results to return
			});

	
			let docMatches = docResults.documents[0];
			let contextText = "";
			let retrievedDocs = [];

			for(let i = 0; i < docMatches.length; i++) {
				//If the similarity score is above a certain threshold, add the document and code to the user input
				if(docMatches[i]) {
					let docID = docResults.ids[0][i];
					let docScore = docResults.distances[0][i];
					console.log(docID);
					console.log(docScore);
					let cleanedDocID = docID.replace(/-\d+$/, '');

					if(docScore < 1.5) {
						if(!retrievedDocs.includes(cleanedDocID)) {
							retrievedDocs.push(cleanedDocID);
							let text = await getDocumentByFileName(cleanedDocID);
							contextText += cleanedDocID + ": " + text + "\n";
						}
						
					}
				}
			}
			if(contextText.trim() !== "") {
				finalQuery = "Context [This information may or may not be relevant to the query]: " 
				+ contextText;
			}

			let messageMatches = messageResults.documents[0];
			let messages = "";

			for(let i = 0; i < messageMatches.length; i++) {
				//If the similarity score is above a certain threshold, add the document and code to the user input
				if(messageMatches[i]) {
					let messageID = messageResults.ids[0][i];
					let messageScore = messageResults.distances[0][i];
					console.log(messageID);
					console.log(messageScore);

					if(messageScore < 1.7) {
						messages += messageMatches[i] + "\n";	
					}
				}
			}
			if(messages.trim() !== "") {
				finalQuery = "Past message history[This information may or may not be relevant to the query]: " 
				+ messages;
			}

			let codeMatches = codeResults.documents[0];
			let relevantCode = "";
			let retrievedCodeFiles = [];

			for(let i = 0; i < codeMatches.length; i++) {
				//If the similarity score is above a certain threshold, add the document and code to the user input
				if(codeMatches[i]) {
					let codeID = codeResults.ids[0][i];
					let codeScore = codeResults.distances[0][i];
					console.log(codeID);
					console.log(codeScore);
					let cleanedCodeID = codeID.replace(/-\d+$/, '');
					if(codeScore < 1.5) {
						if(!retrievedCodeFiles.includes(cleanedCodeID)) {
							retrievedCodeFiles.push(cleanedCodeID);
							let snippet = await getCodeByFileName(cleanedCodeID);
							relevantCode += cleanedCodeID + ": " + snippet + "\n";
						}
					}
				}
			}
	
			if(relevantCode.trim() !== "") {
				finalQuery += ". Codebase [This information may or may not be relevant to the query]: " 
				+ relevantCode;
			}
			finalQuery += (finalQuery !== "") ? ".\n\n User Query: " + userInput :  userInput;
		}
	} catch(exception) {
		console.log(exception);
	} finally {
		console.log(finalQuery);
		if(finalQuery === "") {
			finalQuery = userInput;
		}

		let codeMode = false;
		let codeId = null;
		let textId = "textId-" + Date.now();
		const messageId = Date.now(); // Unique identifier for the message

		panel.webview.postMessage({ command: 'startBotMessage', id: messageId , llmModel: ollama.model});
		panel.webview.postMessage({ command: 'startBotText', id: messageId, textId: textId });

		abortController = new AbortController();
		if(isGPT) {
			currentStream = await openai.chat.completions.create({
				model: "gpt-3.5-turbo",
				messages: [{ "role": "user", content: finalQuery }],
				stream: true,
			});
		} else {
			currentStream = await ollama.stream(finalQuery, { signal: abortController.signal });
		}

		let language = 'javascript'; // default language
		let languageNext = false; 

		for await (let chunk of currentStream) {
			if(isGPT) {
				chunk = chunk.choices[0].delta
			}
			llmResponse += chunk;
			
			if (chunk.includes("```")) {
				codeMode = !codeMode;
				if (codeMode) {
					languageNext = true;
				} else {
					textId = "textId-" + Date.now();
					panel.webview.postMessage({ command: 'startBotText', id: messageId, textId: textId });
				}
				continue;
			}
			if (languageNext) {
				language = chunk;
				console.log(language);
				languageNext = false; // reset the flag
				codeId = "codeId-" + Date.now();
				panel.webview.postMessage({ command: 'startBotCode', id: messageId, codeId: codeId, language: language });
				continue;
			}

			if (codeMode) {
				panel.webview.postMessage({ command: 'updateBotCode', id: messageId, codeId: codeId, code: chunk });
			} else {
				panel.webview.postMessage({ command: 'updateBotText', id: messageId, textId: textId, text: chunk });
			}
		}
		panel.webview.postMessage({ command: 'stopStream' });
		storeMessage();
	}
}

//Stop LLM output stream
async function stopStream(panel) {
    if (currentStream && currentStream.return) {
        abortController.abort();
        await currentStream.return();
    }
	panel.webview.postMessage({ command: 'stopStream' });
	storeMessage();
}

/****************************************************************************
 * Interacting with Vector DB
 ****************************************************************************/


//Function to check if the Chroma container exists and is running
async function checkChromaContainer() {
    return new Promise((resolve, reject) => {
		//First check if the container exists
        exec('docker ps -a -q -f name=chroma-container', (err, stdout, stderr) => {
            if (err) {
                console.error(`Error checking Docker containers: ${err}`);
                reject(err);
                return;
            }

            if (stdout.trim()) {
                // It exists, now let's check if it's running
                exec('docker ps -q -f name=chroma-container', (err, stdout, stderr) => {
                    if (err) {
                        console.error(`Error checking running Docker containers: ${err}`);
                        reject(err);
                        return;
                    }

                    if (stdout.trim()) {
                        // Container is running
                        console.log('Docker container is already running.');
                        resolve();
                    } else {
                        // Container exists but is not running, start it
                        startChromaContainer().then(resolve).catch(reject);
                    }
                });
            } else {
                // Container does not exist, pull the image and run a new container
                pullChromaImage().then(runChromaContainer).then(resolve).catch(reject);
            }
        });
    });
}


// Function to run the Chroma container
async function runChromaContainer() {
    return new Promise((resolve, reject) => {
        exec('docker run -p 8000:8000 --name chroma-container chromadb/chroma', (err, stdout, stderr) => {
            if (err) {
                console.error(`Error starting Docker container: ${err}`);
                reject(err);
                return;
            }
            console.log(`Docker container output: ${stdout}`);
            console.error(`Docker container error output: ${stderr}`);
            resolve();
        });
    });
}

// Function to start an existing Chroma container
async function startChromaContainer() {
    return new Promise(async (resolve, reject) => {
        exec('docker start chroma-container', (err, stdout, stderr) => {
            if (err) {
                console.error(`Error starting existing Docker container: ${err}`);
                reject(err);
                return;
            }
            console.log(`Docker container started: ${stdout}`);
            console.error(`Docker start error output: ${stderr}`);
            resolve();
        });
    });
}

//Function to stop Chroma container
async function stopChromaContainer() {
    try {
        const { stdout, stderr } = await execAsync('docker stop chroma-container');
        console.log(`Docker container stopped: ${stdout}`);
        console.error(`Docker stop error output: ${stderr}`);
    } catch (err) {
        console.error(`Error stopping Docker container: ${err}`);
        throw err;
    }
}

// Function to pull the Chroma Docker image
async function pullChromaImage() {
    return new Promise((resolve, reject) => {
        exec('docker pull chromadb/chroma', (err, stdout, stderr) => {
            if (err) {
                console.error(`Error pulling Docker image: ${err}`);
                reject(err);
                return;
            }
            console.log(`Docker image pulled: ${stdout}`);
            console.error(`Docker pull error output: ${stderr}`);
            resolve();
        });
    });
}

//This function creates the Chroma collections in which docs/code/messages are saved
async function createCollections() {
	docsCollection = await chroma.getOrCreateCollection({
		name: "docs",
	});

	codebaseCollection = await chroma.getOrCreateCollection({
		name: "codebase",
	});

	await chroma.deleteCollection({ name: "messages" });

	messageHistoryCollection = await chroma.getOrCreateCollection({
		name: "messages",
	});
}

//This function uploads files to the vector DB and Postgres
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

	const textSplitter = new RecursiveCharacterTextSplitter({
		chunkSize: 500,
		chunkOverlap: 100,
	});

	//Splitting text into chunks for more effective vector DB functionality
	const chunks = await textSplitter.splitText(uploadedFileText);

	let progressIncrement = 80 / chunks.length;
	let currentPercent = 20;

	let id = 0;
	const promises = chunks.map(async (chunk) => {
		const cleanChunk = chunk.replace(/\n/g, " ");

		let fileID = fileName + "-" + id;
		id += 1;

		try {
			await docsCollection.upsert({
				documents: [
					cleanChunk
				],
				ids: [fileID],
				metadatas: [{fileName: fileName}]
			});

		} catch(exception) {
			console.log(exception);
		}

		panel.webview.postMessage({
			command: 'updateProgress',
			percent: currentPercent + '%'
		});
		currentPercent += progressIncrement;

	});

	await Promise.all(promises);

	upsertDocument(fileName, uploadedFileText);

	uploadedFiles.push(fileName); // Add the filename to the array
	panel.webview.postMessage({
		command: 'updateFileList',
		files: uploadedFiles
	});
	
	panel.webview.postMessage({
        command: 'updateProgress',
        percent: '100%'
    });
}

//This function deletes the file from vector DB and postgres
async function removeFileFromDB(panel, ind) {
	let file = uploadedFiles[ind];
	uploadedFiles.splice(ind, 1); // Remove the file from the array
	panel.webview.postMessage({
		command: 'updateFileList',
		files: uploadedFiles
	});

	try {
		const docsToDelete = await docsCollection.delete({
			where: {fileName: file},
		  });
		  console.log(docsToDelete);
	} catch(exception) {
		console.log(exception);
	} finally {
		deleteDocument(file);
	}
	
}

//Stores codebase in vector DB and postgres
async function storeCodebase(codebase, fileName) {
	vscode.window.setStatusBarMessage('Saving...');

	fileName = fileName.split('/').pop();
	console.log(fileName);

	const lines = codebase.split('\n');

    for (let i = 0; i < lines.length; i += 10) {
        const chunk = "Lines " + i + " to " + (i+10) + ": " + lines.slice(i, i + 10).join('\n');
		const cleanChunk = chunk.replace(/\n/g, " ");
		//console.log(cleanChunk);

		let fileID = fileName + "-" + i;
		try {
			await codebaseCollection.upsert({
				documents: [
					cleanChunk
				],
				ids: [fileID],
				metadatas: [{fileName: fileName}]
			});
		} catch(exception) {
			console.log(exception);
		} finally {
			console.log("Codebase stored successfully.");
		}
    }
	upsertCodebase(fileName, codebase);
}

//Stores message in vector DB and postgres
async function storeMessage() {

	let message = "User: " + userQuery + "\n Assistant: " + llmResponse;

	try {
		await messageHistoryCollection.upsert({
			documents: [
				message
			],
			ids: ["message-" + Date.now()],
		});
	} catch(exception) {
		console.log(exception);
	} finally {
		console.log("Messages stored successfully.");
	}
}


/****************************************************************************
 * LLM Model Management
 ****************************************************************************/


async function changeModel(panel, selectedModel) {
    if (selectedModel == "GPT") {
        isGPT = true;
    } else {
        ollama.model = selectedModel;
        isGPT = false;
    }
	if(installedModels.includes(selectedModel)) {
		console.log("installed");
		panel.webview.postMessage({
			command: 'showInstallButton',
			visible: false,
			model: selectedModel
		});
	} else {
		console.log("not installed");
		panel.webview.postMessage({
			command: 'showInstallButton',
			visible: true,
			model: selectedModel
		});
	}
    console.log(`Switching to model: ${selectedModel}`);
}

async function installModel(panel, selectedModel) {
	if(selectedModel === 'code-buddy') {
		installCodeBuddy(panel);
		return;
	}
	const ollamaProcess = spawn('ollama', ['pull', selectedModel]);
	let logTimer;
	let showP = 0;

    ollamaProcess.stderr.on('data', (data) => {

		showP += 1;
		if(showP % 40 == 0) {
			const dataStr = data.toString();
        	const percentageRegex = /(\d+)%/;

			// Extract percentage using regex
			const match = dataStr.match(percentageRegex);
			if (match) {
				const percentage = match[1];
				console.log(`Progress: ${percentage}%`);
				panel.webview.postMessage({
					command: 'updateProgress',
					percent: percentage + '%'
				});
			}
			if(percentage == 100) {
				panel.webview.postMessage({
					command: 'showInstallButton',
					visible: false,
					model: selectedModel
				});
			}
		}
		
    });

	return new Promise((resolve, reject) => {
		ollamaProcess.on('close', (code) => {
			if (code !== 0) {
				console.error(`Error pulling ollama model: ${code}`);
				return;
			}
			console.log(`Ollama pull completed successfully.`);
			installedModels.push(selectedModel);
			panel.webview.postMessage({
				command: 'showInstallButton',
				visible: false,
				model: selectedModel
			});
		});
		resolve();
	});
}

function execPromise(command) {
	return new Promise((resolve, reject) => {
		exec(command, (error, stdout, stderr) => {
			if (error) {
				reject(error);
				return;
			}
			if (stderr) {
				console.error(`stderr: ${stderr}`);
			}
			resolve(stdout);
		});
	});
}

async function installCodeBuddy(panel) {
	if(!installedModels.includes('phi3')) {
		vscode.window.showInformationMessage("phi3 needs to be installed first.");
		panel.webview.postMessage({
			command: 'updateProgress',
			percent: 100 + '%'
		});
		panel.webview.postMessage({
			command: 'showInstallButton',
			visible: true,
			model: 'code-buddy'
		});
	} else {
		const content = ` FROM phi3
		TEMPLATE "{{ if .System }}<|system|>
		{{ .System }}<|end|>
		{{ end }}{{ if .Prompt }}<|user|>
		{{ .Prompt }}<|end|>
		{{ end }}<|assistant|>
		{{ .Response }}<|end|>"
		PARAMETER stop <|end|>
		PARAMETER stop <|user|>
		PARAMETER stop <|assistant|>

		SYSTEM "You are a coding assistant named Buddy working for a company called Sutherland Global. 
		You will assist users in completing, explaining, and debugging code. User's can upload files as context which you can use to guide
		them in their development experience."
		`;
	
		const filePath = path.join('/tmp', 'ModelfileCustomized');

		console.log(`Writing to file: ${filePath}`);
	
		await fs.writeFile(filePath, content);

		const fileContent = await fs.readFile(filePath, 'utf8');
		console.log('File content:', fileContent);

		const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
		if (!fileExists) {
			console.error(`File not found at path: ${filePath}`);
			return;
		}
	
	
		// Run the terminal command
		exec('ollama create code-buddy -f ' + filePath, (error, stdout, stderr) => {
			if (error) {
			return console.error(`Error executing command: ${error.message}`);
			}
			if (stderr) {
			console.error(`stderr: ${stderr}`);
			}
		});
		panel.webview.postMessage({
			command: 'updateProgress',
			percent: 100 + '%'
		});
	
		installedModels.push('code-buddy');
		panel.webview.postMessage({
			command: 'showInstallButton',
			visible: false,
			model: 'code-buddy'
		});
	}

}

function removeModel(panel, selectedModel) {
	const ollamaProcess = spawn('ollama', ['rm', selectedModel]);

	ollamaProcess.on('close', (code) => {
		if (code !== 0) {
			console.error(`Error removing ollama model: ${code}`);
			return;
		}
		console.log(`Ollama remove completed successfully.`);
		installedModels = installedModels.filter(model => model !== selectedModel);
		panel.webview.postMessage({
			command: 'showInstallButton',
			visible: true,
			model: selectedModel
		});
	});
}

/****************************************************************************
 * Postgres DB Helper Functions
 ****************************************************************************/

// Function to insert or update document
async function upsertDocument(fileName, text) {
	try {
	  const query = `
		INSERT INTO docs (file_name, text)
		VALUES ($1, $2)
		ON CONFLICT (file_name)
		DO UPDATE SET text = EXCLUDED.text;
	  `;
	  const values = [fileName, text];
	  await client.query(query, values);
	  console.log('Document inserted/updated successfully');
	} catch (err) {
	  console.error('Error inserting/updating document', err);
	} 
  }

  // Function to insert or update document
  async function upsertCodebase(fileName, code) {
	try {
	  const query = `
		INSERT INTO codebase (file_name, code)
		VALUES ($1, $2)
		ON CONFLICT (file_name)
		DO UPDATE SET code = EXCLUDED.code;
	  `;
	  const values = [fileName, code];
	  await client.query(query, values);
	  console.log('Document inserted/updated successfully');
	} catch (err) {
	  console.error('Error inserting/updating document', err);
	} 
  }

  async function getCodeByFileName(fileName) {
    try {
        const query = `
            SELECT code FROM codebase
            WHERE file_name = $1
        `;
        const values = [fileName];
        const result = await client.query(query, values);
        if (result.rows.length > 0) {
            // Return the first row (assuming filename is unique)
            return result.rows[0].code;
        } else {
            console.log(`Document with filename '${fileName}' not found`);
            return null;
        }
    } catch (error) {
        console.error("Error fetching document by filename:", error);
        return null; // Return null if an error occurs
    }
}

async function deleteDocument(fileName) {
    try {
        const query = `
            DELETE FROM docs
            WHERE file_name = $1
        `;
        const values = [fileName]; // Match any file_name starting with `fileName` followed by a hyphen and digits
        await client.query(query, values);
        console.log('Documents deleted successfully');
    } catch (err) {
        console.error('Error deleting documents', err);
    }
}

async function getFileNamesFromDocs() {
    try {
        const query = `
            SELECT DISTINCT regexp_replace(file_name, '-\\d+$', '') AS file_name
            FROM docs
        `;
        const result = await client.query(query);
        const fileNames = result.rows.map(row => row.file_name);
        return fileNames;
    } catch (error) {
        console.error("Error fetching file names from docs:", error);
        return []; // Return an empty array if an error occurs
    }
}

async function getDocumentByFileName(fileName) {
    try {
        const query = `
            SELECT text FROM docs
            WHERE file_name = $1
        `;
        const values = [fileName];
        const result = await client.query(query, values);
        if (result.rows.length > 0) {
            // Return the first row (assuming filename is unique)
            return result.rows[0].text;
        } else {
            console.log(`Document with filename '${fileName}' not found`);
            return null;
        }
    } catch (error) {
        console.error("Error fetching document by filename:", error);
        return null; // Return null if an error occurs
    }
}

/****************************************************************************
 * User Interface
 ****************************************************************************/

function getWebviewContent() {
	return `<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>Code Buddy</title>
		<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
		<link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.24.1/themes/prism-tomorrow.min.css" rel="stylesheet" />
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
			}
			.botMessage {
				align-self: flex-start;
				background-color: #262525;
				color: white;
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
		</style>
	</head>
	<body>
		<div id="header">
			<div id="installButtonContainer" style="margin-right: 10px;"></div>
		 	<select id="modelSelect" onchange="changeModel()">
				<option value="code-buddy">code-buddy</option>
                <option value="phi3">phi3</option>
				<option value="granite-code">granite-code</option>
                <option value="llama2">llama2</option>
                <option value="codellama">codellama</option>
				<option value="GPT">GPT</option>
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
							text: message
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
						textElement.textContent = text;
					} else {
						textElement.textContent += text;
					}

                    const chatContainer = document.getElementById('chatContainer');
					if(chatContainer.scrollHeight - chatContainer.scrollTop <= chatContainer.clientHeight + 20) {
						chatContainer.scrollTop = chatContainer.scrollHeight;
					}
                }
            }


            function startBotCode(id, codeId, language) {
                const messageElement = document.getElementById('botMessage-' + id);
                const preElement = document.createElement('pre');
                const codeElement = document.createElement('code');
                codeElement.id = codeId;
				codeElement.className = 'language-' + language;
                preElement.appendChild(codeElement);
                messageElement.appendChild(preElement);

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
				}
			});
		</script>
	</body>
	</html>`;
}



async function deactivate() {
	try {
        await stopChromaContainer();
        console.log('Extension deactivated successfully.');
    } catch (err) {
        console.error(`Error deactivating extension: ${err}`);
    }
}

module.exports = {
    activate,
    deactivate
};
