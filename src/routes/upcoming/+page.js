import { redirect } from '@sveltejs/kit';

/** Upcoming is shown as an off-canvas panel on the Today page. */
export function load() {
	throw redirect(302, '/today');
}
