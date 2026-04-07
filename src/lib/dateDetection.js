import { parse } from 'chrono-node';

const dateKeywordPattern =
	/\b(today|tomorrow|tonight|tmr|next|last|this|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|week|month|year|day)\b/i;

function toLocalIsoDate(date) {
	const localDate = new Date(date);
	localDate.setHours(0, 0, 0, 0);
	return new Date(localDate.getTime() - localDate.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function escapeHtml(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

export function detectActionDate(text, { disabled = false, referenceDate = new Date() } = {}) {
	if (disabled || !String(text || '').trim()) return null;

	const match = parse(text, referenceDate, { forwardDate: true }).find((result) => result.text?.trim());
	if (!match) return null;

	const phrase = match.text.trim();
	if (phrase.length < 3) return null;
	if (!/\d/.test(phrase) && !dateKeywordPattern.test(phrase)) return null;

	const parsedDate = match.start.date();
	if (!(parsedDate instanceof Date) || Number.isNaN(parsedDate.getTime())) return null;

	return {
		phrase,
		start: match.index,
		end: match.index + phrase.length,
		dueDate: toLocalIsoDate(parsedDate)
	};
}

export function buildHighlightedDateHtml(text, match) {
	if (!match) return escapeHtml(text);

	return [
		escapeHtml(text.slice(0, match.start)),
		`<mark class="date-highlight-mark">${escapeHtml(text.slice(match.start, match.end))}</mark>`,
		escapeHtml(text.slice(match.end))
	].join('');
}

export function stripDetectedDateText(text, match) {
	if (!match) return String(text || '').trim();

	const source = String(text || '');
	const before = source.slice(0, match.start);
	const after = source.slice(match.end);
	const trimmedBefore = before.replace(/\s*(by|on|at|before|after|around|for)\s*$/i, ' ');
	const combined = `${trimmedBefore}${after}`
		.replace(/\s{2,}/g, ' ')
		.replace(/\s+([,.;:!?])/g, '$1')
		.trim();

	return combined;
}

export function formatDetectedDate(dateString) {
	if (!dateString) return '';

	return new Date(`${dateString}T00:00:00`).toLocaleDateString('en-IN', {
		weekday: 'short',
		day: 'numeric',
		month: 'short'
	});
}

export function getLineIndexAtCursor(text, selectionStart = 0) {
	return String(text || '')
		.slice(0, selectionStart)
		.split('\n').length - 1;
}

export function isCursorInsideMatch(selectionStart, match, lineStart = 0) {
	if (!match) return false;

	const relativeCursor = Math.max(0, selectionStart - lineStart);
	return relativeCursor >= match.start && relativeCursor <= match.end;
}
