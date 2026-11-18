<script>
	import { onMount, tick } from 'svelte';
	import { getShortcutSuggestions } from '$lib/actionShortcuts';
	import { getModeIcon, modes } from '$lib/tasks';
	import { modalFocus } from '$lib/modalFocus';

	export let open = false;
	export let close = () => {};
	export let submit = () => {};
	export let draft = '';
	export let highlightHtml = '';
	export let actionCount = 0;
	export let activeMode = 'All Modes';
	export let modeColorMap = {};
	export let modeIcons = {};
	export let inputRef = null;
	export let onInput = () => {};
	export let onKeydown = () => {};
	export let ariaLabelledBy = 'add-action-title';

	let suggestions = null;
	let selectedIndex = 0;
	let dialog;
	let editor;
	let mirror;
	let menu;
	let inputWidth;
	let inputHeight;
	const maxMenuHeight = 144;
	$: if (!open) suggestions = null;
	$: listId = `${ariaLabelledBy}-shortcuts`;
	$: if (open && inputWidth && inputHeight && highlightHtml !== undefined) syncEditor();

	onMount(() => {
		const viewport = window.visualViewport;
		viewport?.addEventListener('resize', syncEditor);
		viewport?.addEventListener('scroll', syncEditor);
		return () => {
			viewport?.removeEventListener('resize', syncEditor);
			viewport?.removeEventListener('scroll', syncEditor);
		};
	});

	function getCaretRect(offset) {
		const walker = document.createTreeWalker(mirror, NodeFilter.SHOW_TEXT);
		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			if (offset <= node.length) {
				const range = document.createRange();
				range.setStart(node, offset);
				return range.getBoundingClientRect();
			}
			offset -= node.length;
		}
		return null;
	}

	async function syncEditor() {
		await tick();
		if (!open || !mirror || !inputRef) return;
		mirror.style.width = `${inputRef.clientWidth}px`;
		mirror.style.transform = `translate(${-inputRef.scrollLeft}px, ${-inputRef.scrollTop}px)`;
		if (!menu) return;

		const caret = getCaretRect(inputRef.selectionStart);
		const inputRect = inputRef.getBoundingClientRect();
		const editorRect = editor.getBoundingClientRect();
		const dialogRect = dialog.getBoundingClientRect();
		const viewport = window.visualViewport;
		const top = Math.max(dialogRect.top, viewport?.offsetTop ?? 0);
		const bottom = Math.min(dialogRect.bottom, viewport ? viewport.offsetTop + viewport.height : window.innerHeight);
		if (!caret?.height || caret.bottom <= Math.max(top, inputRect.top) || caret.top >= Math.min(bottom, inputRect.bottom)) {
			menu.style.visibility = 'hidden';
			return;
		}

		const gap = 5;
		const below = bottom - caret.bottom - gap;
		const above = caret.top - top - gap;
		const preferredHeight = Math.min(menu.scrollHeight + 2, maxMenuHeight);
		const openAbove = below < preferredHeight && above > below;
		const maxHeight = Math.max(0, Math.min(maxMenuHeight, openAbove ? above : below));
		const left = Math.max(0, Math.min(caret.left - editorRect.left, editorRect.width - menu.offsetWidth));
		menu.style.left = `${left}px`;
		menu.style.maxHeight = `${maxHeight}px`;
		menu.style.top = `${(openAbove ? caret.top - gap - menu.offsetHeight : caret.bottom + gap) - editorRect.top}px`;
		menu.style.visibility = 'visible';
	}

	function refreshSuggestions(input) {
		suggestions = input.selectionStart === input.selectionEnd
			? getShortcutSuggestions(input.value, input.selectionStart, $modes)
			: null;
		selectedIndex = 0;
		syncEditor();
	}

	function handleInput(event) {
		refreshSuggestions(event.currentTarget);
		onInput(event);
	}

	function chooseShortcut(option) {
		const { start, end } = suggestions;
		const suffix = /^\s/.test(inputRef.value.slice(end)) ? '' : ' ';
		inputRef.setRangeText(option.token + suffix, start, end, 'end');
		inputRef.dispatchEvent(new Event('input', { bubbles: true }));
		suggestions = null;
		inputRef.focus();
	}

	async function handleInputKeydown(event) {
		if (event.isComposing) return;
		const key = event.key;
		if (suggestions && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
			if (key === 'ArrowDown' || key === 'ArrowUp') {
				event.preventDefault();
				const count = suggestions.options.length;
				selectedIndex = (selectedIndex + (key === 'ArrowDown' ? 1 : -1) + count) % count;
				await tick();
				document.getElementById(`${listId}-${selectedIndex}`)?.scrollIntoView({ block: 'nearest' });
				return;
			}
			if (key === 'Enter' || key === 'Escape') {
				event.preventDefault();
				if (key === 'Enter') chooseShortcut(suggestions.options[selectedIndex]);
				else suggestions = null;
				return;
			}
		}
		onKeydown(event);
	}

	function handleDialogKeydown(event) {
		if (event.defaultPrevented || event.isComposing) return;
		if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
			event.preventDefault();
			event.stopPropagation();
			if (actionCount) submit();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			close();
		}
	}
</script>

<svelte:window onresize={syncEditor} />

{#if open}
	<div
		class="pause-modal-backdrop"
		role="button"
		tabindex="0"
		aria-label="Close add action modal"
		onclick={close}
		onkeydown={(event) => event.target === event.currentTarget && ['Enter', ' ', 'Escape'].includes(event.key) && close()}
	>
		<div
			use:modalFocus
			bind:this={dialog}
			class="pause-modal action-capture-modal"
			role="dialog"
			aria-modal="true"
			aria-labelledby={ariaLabelledBy}
			tabindex="0"
			onclick={(event) => event.stopPropagation()}
			onkeydown={handleDialogKeydown}
			onscroll={syncEditor}
		>
			<div class="d-flex justify-content-between align-items-start gap-3 mb-3">
				<div>
					<div class="d-flex align-items-center gap-2 mt-2">
						{#if activeMode !== 'All Modes'}
							<div class="active-mode-badge" style={`background: ${modeColorMap[activeMode] || modeColorMap.Default}; padding: 0.2rem 0.6rem; font-size: 0.75rem;`}>
								<i class="fa-solid {getModeIcon(activeMode, modeIcons)}"></i>
								{activeMode}
							</div>
						{/if}
						<h2 class="h6 mb-0" id={ariaLabelledBy}>Add Actions</h2>
					</div>
					<p class="soft-text small mb-0 mt-1">One line per action. Dates like “tomorrow” are detected automatically.</p>
				</div>
				<button class="icon-button" type="button" aria-label="Close add action modal" onclick={close}>
					<i class="fa-solid fa-xmark"></i>
				</button>
			</div>

			<div class="capture-editor" bind:this={editor}>
				<div class="task-capture-shell">
					<div class="task-capture-highlight" aria-hidden="true">
						<div class="task-capture-highlight-copy" bind:this={mirror}>{@html highlightHtml}</div>
					</div>
					<textarea
						aria-label="Actions, one per line"
						aria-describedby={`${ariaLabelledBy}-help`}
						aria-controls={suggestions ? listId : undefined}
						aria-activedescendant={suggestions ? `${listId}-${selectedIndex}` : undefined}
						bind:this={inputRef}
						bind:clientWidth={inputWidth}
						bind:clientHeight={inputHeight}
						class="form-control task-capture-input"
						bind:value={draft}
						rows="10"
						placeholder={`Finish stand-up notes\nCall bank for KYC update\nPick up medicines on the way home`}
						oninput={handleInput}
						onkeydown={handleInputKeydown}
						onclick={(event) => refreshSuggestions(event.currentTarget)}
						onkeyup={(event) => {
							if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) refreshSuggestions(event.currentTarget);
						}}
						onfocusout={() => (suggestions = null)}
						onscroll={syncEditor}
					></textarea>
				</div>

				{#if suggestions}
					<div class="capture-shortcuts" bind:this={menu} id={listId} role="listbox" aria-label="Action shortcuts">
						{#each suggestions.options as option, index (option.token)}
							<button
								class="capture-shortcut"
								type="button"
								role="option"
								id={`${listId}-${index}`}
								aria-selected={selectedIndex === index}
								tabindex="-1"
								onmousedown={(event) => event.preventDefault()}
								onclick={() => chooseShortcut(option)}
							>
								<span>{option.label}</span>
								{#if option.value}<kbd>{option.token}</kbd>{/if}
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
				<div class="soft-text small" id={`${ariaLabelledBy}-help`}>
					Type <kbd>@</kbd> for modes or <kbd>!</kbd> for stars. Press <kbd>Ctrl/Cmd + Enter</kbd> to add all.
				</div>
				{#if actionCount}
					<div class="badge badge-soft rounded-pill px-3 py-2">{actionCount} ready to add</div>
				{/if}
			</div>

			<div class="d-flex justify-content-end gap-2 mt-3">
				<button class="toolbar-button" type="button" onclick={close}>Cancel</button>
				<button class="toolbar-button active" type="button" onclick={submit} disabled={!actionCount}>
					Add {actionCount || ''} {actionCount === 1 ? 'Action' : 'Actions'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.capture-editor {
		position: relative;
	}

	.task-capture-input, .task-capture-highlight-copy {
		font: 400 1rem/1.7 'Manrope', sans-serif;
		letter-spacing: normal;
		white-space: pre-wrap;
		overflow-wrap: break-word;
		word-break: normal;
	}

	.task-capture-input:focus {
		background: transparent;
	}

	.task-capture-highlight-copy :global(mark) {
		padding: 0;
		border-radius: 0.2rem;
		color: transparent;
	}

	.task-capture-highlight-copy :global(.capture-mode-mark) { background: #424957; }
	.task-capture-highlight-copy :global(.capture-red-mark) { background: #633a35; }
	.task-capture-highlight-copy :global(.capture-blue-mark) { background: #354d69; }
	.task-capture-highlight-copy :global(.capture-yellow-mark) { background: #605025; }
	.task-capture-highlight-copy :global(.capture-none-mark) { background: var(--surface-lighter); }

	.capture-shortcuts {
		position: absolute;
		z-index: 2;
		visibility: hidden;
		width: min(16rem, 100%);
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 0.2rem;
		border: 1px solid var(--line-strong);
		border-radius: 0.7rem;
		background: var(--panel-solid);
		box-shadow: 0 0.5rem 1.4rem #0007;
	}

	.capture-shortcut {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		width: 100%;
		padding: 0.35rem 0.65rem;
		border: 0;
		border-radius: 0.5rem;
		background: transparent;
		color: var(--text);
		font-size: 0.875rem;
		text-align: start;
	}

	.capture-shortcut[aria-selected='true'],
	.capture-shortcut:hover {
		background: var(--line-strong);
	}
</style>
