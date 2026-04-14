import { writable } from 'svelte/store';

const initialState = {
	supported: false,
	checking: false,
	available: false,
	status: 'idle',
	version: '',
	currentVersion: '',
	body: '',
	date: '',
	error: '',
	downloaded: false,
	installing: false,
	lastCheckedAt: ''
};

export const desktopUpdate = writable(initialState);

let pendingUpdate = null;
let initialized = false;

function isDesktopApp() {
	return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

async function loadUpdaterApis() {
	const [{ check }, { relaunch }, { getVersion }] = await Promise.all([
		import('@tauri-apps/plugin-updater'),
		import('@tauri-apps/plugin-process'),
		import('@tauri-apps/api/app')
	]);

	return { check, relaunch, getVersion };
}

export async function checkForDesktopUpdates({ silent = false } = {}) {
	if (!isDesktopApp()) return null;

	desktopUpdate.update((state) => ({
		...state,
		supported: true,
		checking: true,
		status: 'checking',
		error: silent ? '' : state.error
	}));

	try {
		const { check, getVersion } = await loadUpdaterApis();
		const currentVersion = await getVersion();
		const update = await check();
		const checkedAt = new Date().toISOString();

		if (!update) {
			pendingUpdate = null;
			desktopUpdate.set({
				...initialState,
				supported: true,
				checking: false,
				available: false,
				status: 'up-to-date',
				currentVersion,
				error: '',
				lastCheckedAt: checkedAt
			});
			return null;
		}

		pendingUpdate = update;
		desktopUpdate.set({
			...initialState,
			supported: true,
			checking: false,
			available: true,
			status: 'available',
			version: update.version,
			currentVersion: update.currentVersion || currentVersion,
			body: update.body || '',
			date: update.date || '',
			error: '',
			downloaded: false,
			installing: false,
			lastCheckedAt: checkedAt
		});
		return update;
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unable to check for updates.';
		desktopUpdate.update((state) => ({
			...state,
			supported: true,
			checking: false,
			status: 'error',
			error: silent ? state.error : message
		}));
		return null;
	}
}

export async function installDesktopUpdate() {
	if (!pendingUpdate) return;

	desktopUpdate.update((state) => ({
		...state,
		installing: true,
		status: 'installing',
		error: ''
	}));

	try {
		const { relaunch } = await loadUpdaterApis();
		await pendingUpdate.downloadAndInstall();
		desktopUpdate.update((state) => ({
			...state,
			downloaded: true,
			status: 'downloaded'
		}));
		await relaunch();
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unable to install the update.';
		desktopUpdate.update((state) => ({
			...state,
			installing: false,
			status: 'error',
			error: message
		}));
	}
}

export function dismissDesktopUpdate() {
	desktopUpdate.update((state) => ({
		...state,
		available: false,
		error: '',
		installing: false,
		status: state.downloaded ? 'downloaded' : 'dismissed'
	}));
}

export async function initDesktopUpdater() {
	if (initialized || !isDesktopApp()) return;

	initialized = true;
	desktopUpdate.update((state) => ({
		...state,
		supported: true
	}));

	await checkForDesktopUpdates({ silent: true });
}

export function isDesktopUpdaterAvailable() {
	return isDesktopApp();
}
