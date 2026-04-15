import { existsSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

const artifactPaths = [
	'.svelte-kit',
	'build',
	'dist',
	'release',
	'src-tauri/target',
	'src-tauri/gen'
];

for (const relativePath of artifactPaths) {
	const absolutePath = resolve(rootDir, relativePath);
	if (!existsSync(absolutePath)) {
		continue;
	}

	rmSync(absolutePath, { recursive: true, force: true });
	console.log(`Removed ${relativePath}`);
}
