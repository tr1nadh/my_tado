<script>
	import { onMount, tick } from 'svelte';
	import { flip } from 'svelte/animate';
	import { fly } from 'svelte/transition';
	import {
		buildHighlightedDateHtml,
		detectActionDate,
		getLineIndexAtCursor,
		isCursorInsideMatch,
		stripDetectedDateText
	} from '$lib/dateDetection';
	import TaskRow from '$lib/components/TaskRow.svelte';
	import {
		activeMode,
		addTask,
		clearDoneForMode,
		getModeIcon,
		modeColorMap,
		modeIcons,
		modeMatches,
		tasks
	} from '$lib/tasks';

	let search = '';
	let showDone = false;
	let searchOpen = false;
	let searchInput;
	let actionModalOpen = false;
	let actionDraft = '';
	let actionInput;
	let panelDirection = 1;
	let actionDismissedPhrases = [];
	export let open = false;
	export let closePanel = () => {};

	function isInboxTask(task) {
		const d = task.dueDate;
		return !d || String(d).trim() === '';
	}

	$: showModeBadge = $activeMode === 'All Modes';
	$: scopedTasks = $tasks.filter((task) => modeMatches(task, $activeMode) && isInboxTask(task));
	$: modalSearchedTasks = scopedTasks.filter((task) => {
		if (!search) return true;
		return task.title.toLowerCase().includes(search.toLowerCase());
	});
	$: openInboxTasks = scopedTasks.filter((task) => !task.done);
	$: activeOpenTasks = openInboxTasks.filter((t) => !t.paused);
	$: pausedActions = scopedTasks.filter((task) => !task.done && task.paused);
	$: completedTasks = scopedTasks.filter((task) => task.done);
	$: actionCount = actionDraft
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean).length;
	$: actionLines = actionDraft.split('\n');
	$: actionHighlightHtml = actionLines
		.map((line, index) => {
			const match = detectActionDate(line);
			return buildHighlightedDateHtml(
				line,
				match && match.phrase.toLowerCase() !== (actionDismissedPhrases[index] || '') ? match : null
			);
		})
		.join('\n');

	async function openSearch() {
		searchOpen = true;
		await tick();
		searchInput?.focus();
		searchInput?.select();
	}

	async function openActionModal() {
		actionModalOpen = true;
		actionDismissedPhrases = [''];
		await tick();
		actionInput?.focus();
	}

	function syncActionDateDismissed() {
		actionDismissedPhrases = actionLines.map((_, index) => actionDismissedPhrases[index] || '');
	}

	function getEffectiveActionDateMatch(line, index) {
		const match = detectActionDate(line);
		return match && match.phrase.toLowerCase() !== (actionDismissedPhrases[index] || '') ? match : null;
	}

	function closeSearch() {
		searchOpen = false;
		search = '';
	}

	function closeActionModal() {
		actionModalOpen = false;
		actionDraft = '';
		actionDismissedPhrases = [];
	}

	function submitActions() {
		const lines = actionDraft.split('\n');
		const entries = lines
			.map((line, index) => {
				const match = getEffectiveActionDateMatch(line, index);
				const title = stripDetectedDateText(line, match);
				if (!title) return null;
				return { title, dueDate: match?.dueDate || '' };
			})
			.filter(Boolean);

		if (!entries.length) return;

		const currentMode = $activeMode;

		for (const entry of entries) {
			addTask({
				title: entry.title,
				mode: currentMode,
				priority: 'Medium',
				energy: 'Quick',
				context: '',
				dueDate: entry.dueDate
			});
		}

		closeActionModal();
	}

	function handleActionDraftKeydown(event) {
		if (event.key !== 'Escape') return;

		const selectionStart = event.currentTarget.selectionStart ?? 0;
		const lineIndex = getLineIndexAtCursor(actionDraft, selectionStart);
		const line = actionLines[lineIndex] || '';
		const match = detectActionDate(line);
		if (!match) return;

		const lineStart = actionLines.slice(0, lineIndex).join('\n').length + (lineIndex > 0 ? 1 : 0);
		if (isCursorInsideMatch(selectionStart, match, lineStart)) {
			actionDismissedPhrases = actionDismissedPhrases.map((value, index) =>
				index === lineIndex ? match.phrase.toLowerCase() : value || ''
			);
			event.preventDefault();
		}
	}

	function handleActionDraftInput() {
		syncActionDateDismissed();
	}

	function openCompletedView() {
		panelDirection = 1;
		showDone = true;
	}

	function openPendingView() {
		panelDirection = -1;
		showDone = false;
	}

	onMount(() => {
		function handleKeydown(event) {
			if (actionModalOpen) {
				if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
					event.preventDefault();
					submitActions();
				}

				if (event.key === 'Escape') {
					event.preventDefault();
					closeActionModal();
				}

				return;
			}

			if (event.ctrlKey && event.key.toLowerCase() === 'f') {
				event.preventDefault();
				openSearch();
			}

			if (event.key === 'Escape') {
				event.preventDefault();
				if (searchOpen) closeSearch();
				showDone = false;
			}
		}

		function handleMobileSearch() {
			openSearch();
		}

		window.addEventListener('keydown', handleKeydown);
		window.addEventListener('karya:mobile-search', handleMobileSearch);
		return () => {
			window.removeEventListener('keydown', handleKeydown);
			window.removeEventListener('karya:mobile-search', handleMobileSearch);
		};
	});

</script>

<div class="inbox-offcanvas-root" class:open={open}>
	<button
		type="button"
		class="inbox-offcanvas-scrim"
		aria-label="Close inbox panel"
		onclick={closePanel}
	></button>
	<div class="today-time-rail-container inbox-offcanvas-rail-slot">
		<aside
			class={`today-time-rail ${open ? 'open' : 'collapsed'} floating inbox-rail`}
			aria-label="Inbox"
		>
			<div class="today-time-rail-content" style="padding: 1.5rem; overflow-y: auto;">
				<div class="d-flex align-items-center justify-content-between mb-2">
					<h2 class="h5 mb-0">Inbox</h2>
					<button class="icon-button" type="button" aria-label="Close" title="Close" onclick={closePanel}>
						<i class="fa-solid fa-xmark"></i>
					</button>
				</div>
				<p class="soft-text small mb-4">Unscheduled actions. Add a date from the row menu when you are ready to schedule.</p>

				<div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
					<div class="d-flex align-items-center gap-3 flex-wrap">
						<div
							class="badge-soft rounded-pill px-3 py-2 font-monospace"
							style="font-size: 0.72rem; letter-spacing: 0.02em; font-weight: 600; text-transform: uppercase; opacity: 0.9;"
						>
							{openInboxTasks.length}
							{openInboxTasks.length === 1 ? 'action' : 'actions'}
						</div>
						{#if !showDone && completedTasks.length}
							<button class="toolbar-button" type="button" onclick={openCompletedView}>
								Completed ({completedTasks.length})
							</button>
						{/if}
						{#if showDone}
							<button class="toolbar-button" type="button" onclick={openPendingView}>Back to open</button>
							<button class="toolbar-button" type="button" onclick={clearDoneForMode}>Clear done</button>
						{/if}
					</div>
					<div class="d-flex align-items-center gap-2">
						<button
							class="icon-button search-launch-button"
							type="button"
							aria-label="Search actions"
							onclick={openSearch}
						>
							<i class="fa-solid fa-magnifying-glass"></i>
						</button>
						<button
							class="btn btn-brand"
							type="button"
							aria-label="Add Action"
							onclick={openActionModal}
							style="width: 2.4rem; height: 2.4rem; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 0.7rem;"
						>
							<i class="fa-solid fa-plus"></i>
						</button>
					</div>
				</div>

				{#if showDone}
					{#if completedTasks.length}
						<section
							class="mb-4"
							in:fly={{ x: panelDirection > 0 ? 72 : -72, duration: 150 }}
							out:fly={{ x: panelDirection > 0 ? 56 : -56, duration: 120 }}
						>
							<div class="list-heading">Completed</div>
							<div class="task-list">
								{#each completedTasks as task (task.id)}
									<div class="task-reorder-item" animate:flip={{ duration: 180 }}>
										<TaskRow {task} disableOptions={searchOpen} {showModeBadge} />
									</div>
								{/each}
							</div>
						</section>
					{:else}
						<div class="empty-state">No completed inbox actions.</div>
					{/if}
				{:else}
					<div
						in:fly={{ x: panelDirection < 0 ? -72 : 72, duration: 150 }}
						out:fly={{ x: panelDirection < 0 ? -56 : 56, duration: 120 }}
					>
						{#if activeOpenTasks.length}
							<section class="mb-4">
								<div class="list-heading">Open</div>
								<div class="task-list">
									{#each activeOpenTasks as task (task.id)}
										<div class="task-reorder-item" animate:flip={{ duration: 180 }}>
											<TaskRow {task} disableOptions={searchOpen} {showModeBadge} />
										</div>
									{/each}
								</div>
							</section>
						{:else if !pausedActions.length}
							<div class="empty-state">Inbox is clear for this mode.</div>
						{/if}

						{#if pausedActions.length}
							<section class="mt-4">
								<div class="list-heading">Paused</div>
								<div class="task-list">
									{#each pausedActions as task (task.id)}
										<div class="task-reorder-item" animate:flip={{ duration: 180 }}>
											<TaskRow {task} disableOptions={searchOpen} {showModeBadge} />
										</div>
									{/each}
								</div>
							</section>
						{/if}
					</div>
				{/if}
			</div>
		</aside>
	</div>
</div>

{#if actionModalOpen}
	<div
		class="pause-modal-backdrop"
		role="button"
		tabindex="0"
		aria-label="Close add action modal"
		onclick={closeActionModal}
		onkeydown={(event) =>
			event.target === event.currentTarget && ['Enter', ' ', 'Escape'].includes(event.key) && closeActionModal()}
	>
		<div
			class="pause-modal action-capture-modal"
			role="dialog"
			aria-modal="true"
			aria-labelledby="add-action-title-inbox"
			tabindex="0"
			onclick={(event) => event.stopPropagation()}
			onkeydown={(event) => event.key === 'Escape' && closeActionModal()}
		>
			<div class="d-flex justify-content-between align-items-start gap-3 mb-3">
				<div>
					<div class="section-label">Quick Capture</div>
					<div class="d-flex align-items-center gap-2 mt-2">
						{#if $activeMode !== 'All Modes'}
							<div
								class="active-mode-badge"
								style={`background: ${modeColorMap[$activeMode] || modeColorMap.Default}; padding: 0.2rem 0.6rem; font-size: 0.75rem;`}
							>
								<i class="fa-solid {getModeIcon($activeMode, $modeIcons)}"></i>
								{$activeMode}
							</div>
						{/if}
						<h2 class="h6 mb-0" id="add-action-title-inbox">Add to Inbox</h2>
					</div>
					<p class="soft-text small mb-0 mt-1">
						Lines without a date stay in Inbox. Natural-language dates are detected automatically.
					</p>
				</div>
				<button class="icon-button" type="button" aria-label="Close add action modal" onclick={closeActionModal}>
					<i class="fa-solid fa-xmark"></i>
				</button>
			</div>

			<div class="task-capture-shell">
				<div class="task-capture-highlight" aria-hidden="true">
					<div class="task-capture-highlight-copy">
						{@html actionHighlightHtml}
					</div>
				</div>
				<textarea
					bind:this={actionInput}
					class="form-control task-capture-input"
					bind:value={actionDraft}
					rows="10"
					placeholder={`Ideas without a date yet\nTomorrow call dentist\nFriday pick up parcel`}
					oninput={handleActionDraftInput}
					onkeydown={handleActionDraftKeydown}
				></textarea>
			</div>

			<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
				<div class="soft-text small">Press `Enter` for a new line. Press `Ctrl/Cmd + Enter` to add all.</div>
				{#if actionCount}
					<div class="badge badge-soft rounded-pill px-3 py-2">{actionCount} ready to add</div>
				{/if}
			</div>

			<div class="d-flex justify-content-end gap-2 mt-3">
				<button class="toolbar-button" type="button" onclick={closeActionModal}>Cancel</button>
				<button class="toolbar-button active" type="button" onclick={submitActions} disabled={!actionCount}>
					Add {actionCount || ''} {actionCount === 1 ? 'Action' : 'Actions'}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if searchOpen}
	<div
		class="pause-modal-backdrop"
		role="button"
		tabindex="0"
		aria-label="Close search"
		onclick={closeSearch}
		onkeydown={(event) =>
			event.target === event.currentTarget && ['Enter', ' ', 'Escape'].includes(event.key) && closeSearch()}
	>
		<div
			class="pause-modal search-modal"
			role="dialog"
			aria-modal="true"
			aria-labelledby="search-actions-title-inbox"
			tabindex="0"
			onclick={(event) => event.stopPropagation()}
			onkeydown={(event) => event.key === 'Escape' && closeSearch()}
		>
			<div class="d-flex justify-content-between align-items-start gap-3 mb-3">
				<div>
					<div class="section-label">Search</div>
					<h2 class="h6 mt-2 mb-1" id="search-actions-title-inbox">Search Inbox</h2>
					<p class="soft-text small mb-0">Search inside the current Inbox view.</p>
				</div>
				<button class="icon-button" type="button" aria-label="Close search" onclick={closeSearch}>
					<i class="fa-solid fa-xmark"></i>
				</button>
			</div>

			<input
				bind:this={searchInput}
				class="form-control"
				type="text"
				bind:value={search}
				placeholder="Search actions"
			/>

			<div class="search-results-shell mt-3">
				{#if search.trim()}
					{#if modalSearchedTasks.length}
						<div class="search-results-list task-list">
							{#each modalSearchedTasks as task (task.id)}
								<div class="search-result-row">
									<TaskRow {task} {showModeBadge} />
								</div>
							{/each}
						</div>
					{:else}
						<div class="empty-state">No actions match this search.</div>
					{/if}
				{:else}
					<div class="empty-state">Start typing to search Inbox.</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.inbox-offcanvas-root {
		position: fixed;
		inset: 0;
		z-index: 1040;
		pointer-events: none;
	}

	.inbox-offcanvas-root.open {
		pointer-events: auto;
	}

	.inbox-offcanvas-scrim {
		position: absolute;
		inset: 0;
		border: 0;
		padding: 0;
		margin: 0;
		background: rgba(0, 0, 0, 0.45);
		opacity: 0;
		transition: opacity 0.22s ease;
		cursor: default;
	}

	.inbox-offcanvas-root.open .inbox-offcanvas-scrim {
		opacity: 1;
	}

	.inbox-offcanvas-rail-slot {
		position: absolute;
		top: 0;
		right: 0;
		bottom: 0;
		width: 0;
		height: 100%;
		max-height: 100dvh;
		z-index: 1;
		pointer-events: none;
	}

	.inbox-offcanvas-root.open .inbox-offcanvas-rail-slot {
		pointer-events: auto;
	}
</style>
