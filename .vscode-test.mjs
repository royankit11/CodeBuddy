import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	files: 'test/**/*.test.js',
	mocha: {
		ui: 'tdd',
		timeout: 45000
	  }
});
