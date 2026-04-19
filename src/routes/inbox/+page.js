import { redirect } from '@sveltejs/kit';

/** Inbox is opened from the Today page (island nav off-canvas). */
export function load() {
	throw redirect(302, '/today');
}
