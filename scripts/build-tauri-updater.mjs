import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');
const tauriConfigPath = join(rootDir, 'src-tauri', 'tauri.conf.json');
const bundleDir = join(rootDir, 'src-tauri', 'target', 'release', 'bundle');
const signingEnvPath = join(homedir(), '.tauri', 'karya-signing.env');
const githubRepo = 'https://github.com/tr1nadh/my_tado';

function parseEnvFile(filePath) {
	const raw = readFileSync(filePath, 'utf8');
	return Object.fromEntries(
		raw
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean)
			.filter((line) => !line.startsWith('#'))
			.map((line) => {
				const separator = line.indexOf('=');
				return [line.slice(0, separator), line.slice(separator + 1)];
			})
	);
}

function run(command, args, options = {}) {
	return new Promise((resolvePromise, rejectPromise) => {
		const child = spawn(command, args, {
			cwd: rootDir,
			stdio: 'inherit',
			shell: process.platform === 'win32',
			...options
		});

		child.on('exit', (code) => {
			if (code === 0) {
				resolvePromise();
				return;
			}

			rejectPromise(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
		});
	});
}

function walk(dirPath) {
	const results = [];
	for (const entry of readdirSync(dirPath)) {
		const fullPath = join(dirPath, entry);
		const stats = statSync(fullPath);
		if (stats.isDirectory()) {
			results.push(...walk(fullPath));
		} else {
			results.push(fullPath);
		}
	}
	return results;
}

function inferPlatform(fileName) {
	const normalized = fileName.toLowerCase();
	if (normalized.includes('aarch64') || normalized.includes('arm64')) return 'windows-aarch64';
	if (normalized.includes('i686') || normalized.includes('x86')) return 'windows-i686';
	return 'windows-x86_64';
}

function pickUpdaterArtifacts() {
	const signatureFiles = walk(bundleDir).filter((filePath) => filePath.endsWith('.sig'));
	if (!signatureFiles.length) {
		throw new Error('No updater signature files were generated. Make sure updater artifacts are enabled.');
	}

	const preferredOrder = ['.nsis.zip.sig', '.msi.zip.sig', '.app.tar.gz.sig', '.tar.gz.sig', '.zip.sig', '.exe.sig', '.msi.sig'];
	const sorted = [...signatureFiles].sort((left, right) => {
		const leftRank = preferredOrder.findIndex((suffix) => left.endsWith(suffix));
		const rightRank = preferredOrder.findIndex((suffix) => right.endsWith(suffix));
		return (leftRank === -1 ? 999 : leftRank) - (rightRank === -1 ? 999 : rightRank);
	});

	return sorted.map((signaturePath) => {
		const artifactPath = signaturePath.slice(0, -4);
		const fileName = basename(artifactPath);
		const signature = readFileSync(signaturePath, 'utf8').trim();
		return {
			platform: inferPlatform(fileName),
			fileName,
			signature
		};
	});
}

async function main() {
	if (!existsSync(signingEnvPath)) {
		throw new Error(`Missing signing profile at ${signingEnvPath}.`);
	}

	const signingEnv = parseEnvFile(signingEnvPath);
	const privateKeyPath = signingEnv.TAURI_SIGNING_PRIVATE_KEY_PATH;
	if (!privateKeyPath || !existsSync(privateKeyPath)) {
		throw new Error(`Missing private signing key at ${privateKeyPath || 'unknown path'}.`);
	}
	const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, 'utf8'));
	const version = tauriConfig.version;
	const tag = `v${version}`;

	await run('npx', ['tauri', 'build'], {
		env: {
			...process.env,
			...signingEnv,
			TAURI_SIGNING_PRIVATE_KEY: readFileSync(privateKeyPath, 'utf8'),
			TAURI_SIGNING_PRIVATE_KEY_PASSWORD: signingEnv.TAURI_SIGNING_PRIVATE_KEY_PASSWORD || ''
		}
	});

	const artifacts = pickUpdaterArtifacts();
	const latestJson = {
		version,
		notes: `Karya ${version}`,
		pub_date: new Date().toISOString(),
		platforms: Object.fromEntries(
			artifacts.map((artifact) => [
				artifact.platform,
				{
					signature: artifact.signature,
					url: `${githubRepo}/releases/download/${tag}/${artifact.fileName}`
				}
			])
		)
	};

	const updaterDir = join(bundleDir, 'updater');
	mkdirSync(updaterDir, { recursive: true });
	const latestJsonPath = join(updaterDir, 'latest.json');
	writeFileSync(latestJsonPath, JSON.stringify(latestJson, null, 2));

	console.log(`Updater metadata written to ${latestJsonPath}`);
}

main().catch((error) => {
	console.error(error.message);
	process.exit(1);
});
