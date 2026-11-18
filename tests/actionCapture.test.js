import { registerHooks } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { get } from 'svelte/store';

registerHooks({
	resolve(specifier, context, next) {
		if (specifier === '$app/environment') return { url: 'data:text/javascript,export const browser = true', shortCircuit: true };
		return next(specifier, context);
	}
});

const modes = ['All Modes', 'Work', 'Work Sprint', 'Home Reset', 'Next Monday'];
const saved = new Map();
Object.defineProperty(globalThis, 'localStorage', {
	value: {
		getItem: (key) => saved.get(key) ?? null,
		setItem: (key, value) => saved.set(key, value)
	}
});

test('mode suggestions narrow as you type on the active line', async () => {
	const { getShortcutSuggestions } = await import('../src/lib/actionShortcuts.js');
	const draft = 'First action\nSend report @work s';
	assert.deepEqual(getShortcutSuggestions(draft, draft.length, modes).options.map((option) => option.label), ['Work Sprint']);
	assert.deepEqual(getShortcutSuggestions('@', 1, modes).options.map((option) => option.label), modes.slice(1));
	assert.equal(getShortcutSuggestions('Write a@work', 12, modes), null);
});

test('star suggestions use the existing priority order and filter by number', async () => {
	const { getShortcutSuggestions } = await import('../src/lib/actionShortcuts.js');
	assert.deepEqual(getShortcutSuggestions('!', 1, modes).options.map((option) => option.label), ['Red star', 'Blue star', 'Yellow star', 'Remaining']);
	assert.deepEqual(getShortcutSuggestions('!3', 2, modes).options.map((option) => option.token), ['!3']);
});

test('capture saves the mode and star while preserving the title and its actual date', async () => {
	const { parseActionShortcuts } = await import('../src/lib/actionShortcuts.js');
	const { detectActionDate, stripDetectedDateText } = await import('../src/lib/dateDetection.js');
	const line = 'Email dev@example.com @next monday !2 tomorrow';
	const { text, mode, todayStar } = parseActionShortcuts(line, modes);
	const date = detectActionDate(text);
	assert.equal(date.phrase, 'tomorrow');
	assert.equal(line.slice(date.start, date.end), 'tomorrow');
	assert.equal(stripDetectedDateText(text, date), 'Email dev@example.com');
	assert.equal(mode, 'Next Monday');
	assert.equal(todayStar, 'blue');
	assert.equal(parseActionShortcuts('Send report @work sprint !4', modes).mode, 'Work Sprint');
	assert.equal(parseActionShortcuts('Send report @work sprint !4', modes).todayStar, 'none');
	assert.equal(parseActionShortcuts('Hey! !123 @unknown', modes).text, 'Hey! !123 @unknown');
});

test('capture highlights recognized shortcuts and dates without altering the draft text', async () => {
	const { buildCaptureHighlightHtml } = await import('../src/lib/actionShortcuts.js');
	const draft = 'Email <team> @work sprint !2 tomorrow\nKeep !123 @unknown';
	assert.equal(buildCaptureHighlightHtml(draft, [], modes),
		'Email &lt;team&gt; <mark class="capture-mode-mark">@work sprint</mark> ' +
		'<mark class="capture-blue-mark">!2</mark> <mark class="date-highlight-mark">tomorrow</mark>\nKeep !123 @unknown');
	assert.equal(buildCaptureHighlightHtml('Send !4 tomorrow', ['tomorrow'], modes),
		'Send <mark class="capture-none-mark">!4</mark> tomorrow');
});

test('reset clears saved actions, custom modes, icons and settings across reloads', async () => {
	const app = await import('../src/lib/tasks.js');
	app.initTasks();
	app.createMode('Custom mode');
	app.activeMode.set('Custom mode');
	app.modeIcons.set({ 'Custom mode': 'fa-code' });
	app.updateSettings({ todayStarLimit: 9, todayRailPinned: true });
	localStorage.setItem('unrelated', 'keep');

	app.resetAppData();
	assert.deepEqual(get(app.tasks), []);
	assert.equal(get(app.activeMode), 'All Modes');

	const reloaded = await import('../src/lib/tasks.js?reload');
	reloaded.initTasks();
	assert.deepEqual(get(reloaded.tasks), []);
	assert.equal(get(reloaded.modes).includes('Custom mode'), false);
	assert.deepEqual(get(reloaded.modeIcons), {});
	assert.equal(get(reloaded.settings).todayStarLimit, 5);
	assert.equal(get(reloaded.settings).todayRailPinned, false);
	assert.equal(localStorage.getItem('unrelated'), 'keep');
});
