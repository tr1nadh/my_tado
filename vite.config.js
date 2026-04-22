import { sveltekit } from '@sveltejs/kit/vite';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

export default defineConfig({
	plugins: [sveltekit()],
	define: {
		__WEB_VERSION__: JSON.stringify(packageJson.version || 'unknown')
	}
});
