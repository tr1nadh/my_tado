import { todayStarOptions } from './tasks.js';
import { detectActionDate, escapeHtml } from './dateDetection.js';

const starShortcuts = todayStarOptions.map((star, index) => ({ ...star, token: `!${index + 1}` }));

function assignableModes(modes) {
	return modes.filter((mode) => mode !== 'All Modes');
}

export function getShortcutSuggestions(draft, cursor, modes) {
	const beforeCursor = draft.slice(0, cursor);
	const match = beforeCursor.match(/(?:^|\s)(@[^@!\n]*|!\d*)$/);
	if (!match) return null;

	const query = match[1].toLowerCase();
	const start = cursor - match[1].length;
	const choices = query.startsWith('@')
		? assignableModes(modes).map((mode) => ({ label: mode, token: `@${mode}` }))
		: starShortcuts;
	const options = choices.filter((option) => option.token.toLowerCase().startsWith(query));
	if (!options.length) return null;

	const rest = draft.slice(start).toLowerCase();
	const existing = options.filter(({ token }) => rest.startsWith(token.toLowerCase()) &&
		(!rest[token.length] || /\s/.test(rest[token.length])))
		.sort((left, right) => right.token.length - left.token.length)[0];
	return { start, end: existing ? start + existing.token.length : cursor, options };
}

export function parseActionShortcuts(line, modes) {
	const names = assignableModes(modes).sort((left, right) => right.length - left.length);
	const modeTokens = names.map((name) => `@${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
	const pattern = new RegExp(`(^|\\s)(${[...modeTokens, '![1-4]'].join('|')})(?=\\s|$)`, 'gi');
	let mode;
	let todayStar;
	const shortcuts = [];
	// Preserve character positions so date highlights still align with the draft.
	const text = line.replace(pattern, (_, prefix, token, index) => {
		const start = index + prefix.length;
		const end = start + token.length;
		if (token.startsWith('@')) {
			mode = names.find((name) => name.toLowerCase() === token.slice(1).toLowerCase());
			shortcuts.push({ start, end, className: 'capture-mode-mark' });
		} else {
			todayStar = starShortcuts[Number(token.slice(1)) - 1].value;
			shortcuts.push({ start, end, className: `capture-${todayStar}-mark` });
		}
		return prefix + ' '.repeat(token.length);
	});
	return { text, mode, todayStar, shortcuts };
}

export function buildCaptureHighlightHtml(draft, dismissedPhrases, modes) {
	return draft.split('\n').map((line, index) => {
		const { text, shortcuts } = parseActionShortcuts(line, modes);
		const date = detectActionDate(text);
		const marks = [...shortcuts];
		if (date && date.phrase.toLowerCase() !== dismissedPhrases[index]) {
			let start = date.start;
			// A date can span a masked shortcut. Keep that shortcut's own highlight.
			for (const shortcut of shortcuts) {
				if (shortcut.end <= start || shortcut.start >= date.end) continue;
				if (start < shortcut.start) marks.push({ start, end: shortcut.start, className: 'date-highlight-mark' });
				start = shortcut.end;
			}
			if (start < date.end) marks.push({ start, end: date.end, className: 'date-highlight-mark' });
		}

		let html = '';
		let offset = 0;
		for (const { start, end, className } of marks.sort((left, right) => left.start - right.start)) {
			html += escapeHtml(line.slice(offset, start));
			html += `<mark class="${className}">${escapeHtml(line.slice(start, end))}</mark>`;
			offset = end;
		}
		return html + escapeHtml(line.slice(offset));
	}).join('\n');
}
