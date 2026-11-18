// Keep keyboard navigation inside a modal and return focus to its opener.
export function modalFocus(node) {
	const opener = document.activeElement;
	const previousOverflow = document.body.style.overflow;
	document.body.style.overflow = 'hidden';
	const focusable = () => [...node.querySelectorAll('button:not(:disabled), input, textarea, select, a[href], [tabindex="0"]')]
		.filter((element) => element.getClientRects().length);
	(node.querySelector('textarea, input') || focusable()[0] || node).focus();
	function trap(event) {
		if (event.key !== 'Tab') return;
		const items = focusable();
		const first = items[0];
		const last = items.at(-1);
		if (!first) {
			event.preventDefault();
			node.focus();
		} else if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}
	node.addEventListener('keydown', trap);
	return { destroy() {
		node.removeEventListener('keydown', trap);
		document.body.style.overflow = previousOverflow;
		if (opener?.isConnected) opener.focus();
	} };
}
