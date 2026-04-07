<script>
	import { onDestroy, onMount, tick } from 'svelte';
	import { fly } from 'svelte/transition';
	import {
		buildHighlightedDateHtml,
		detectActionDate,
		formatDetectedDate,
		getLineIndexAtCursor,
		isCursorInsideMatch,
		stripDetectedDateText
	} from '$lib/dateDetection';
	import TaskRow from '$lib/components/TaskRow.svelte';
	import { activeMode, addTask, clearDoneForMode, modeMatches, tasks } from '$lib/tasks';

	let search = '';
	let showDone = false;
	let searchOpen = false;
	let searchInput;
	let actionModalOpen = false;
	let actionDraft = '';
	let actionInput;
	let pausedSection;
	let pausedVisible = false;
	let pausedObserver;
	let panelDirection = 1;
	let actionDismissedPhrases = [];

	$: modeTasks = $tasks.filter((task) => modeMatches(task, $activeMode));
	$: searchedTasks = modeTasks.filter((task) => {
		const matchesSearch =
			!search ||
			task.title.toLowerCase().includes(search.toLowerCase());

		return matchesSearch;
	});
	$: openTasks = searchedTasks.filter((task) => !task.done);
	$: activeActions = openTasks.filter((task) => !task.paused);
	$: pausedActions = openTasks.filter((task) => task.paused);
	$: completedTasks = searchedTasks.filter((task) => task.done);
	$: actionCount = actionDraft
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean).length;
	$: showPausedJump = !showDone && pausedActions.length > 0 && (!pausedSection || !pausedVisible);
	$: actionLines = actionDraft.split('\n');
	$: actionDatePreviews = actionLines
		.map((line, index) => {
			const match = detectActionDate(line);

			if (!match) return null;
			if (match.phrase.toLowerCase() === (actionDismissedPhrases[index] || '')) return null;

			return {
				index,
				match,
				html: buildHighlightedDateHtml(line, match)
			};
		})
		.filter(Boolean);
	$: actionHighlightHtml = actionLines
		.map((line, index) => {
			const match = detectActionDate(line);
			return buildHighlightedDateHtml(
				line,
				match && match.phrase.toLowerCase() !== (actionDismissedPhrases[index] || '') ? match : null
			);
		})
		.join('\n');

	$: {
		pausedObserver?.disconnect();
		if (pausedSection) {
			pausedObserver = new IntersectionObserver(
				([entry]) => {
					pausedVisible = entry.isIntersecting;
				},
				{ threshold: 0.2 }
			);
			pausedObserver.observe(pausedSection);
		} else {
			pausedVisible = false;
		}
	}

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
				const match = detectActionDate(line);
				const title = stripDetectedDateText(line, match);
				if (!title) return null;
				return { title, dueDate: match?.dueDate || '' };
			})
			.filter(Boolean);

		if (!entries.length) return;

		const currentMode = $activeMode === 'All Modes' ? 'Work Sprint' : $activeMode;

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

	function jumpToPaused() {
		pausedSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	});

	onDestroy(() => pausedObserver?.disconnect());
</script>

<div class="soft-text small mb-3 px-1">
	Press `Ctrl + F` to search. Press `Escape` to hide.
</div>

<div class="actions-panel-shell">
	<section class="glass-panel rounded-4 p-4 fade-up">
		<div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
			<div class="d-flex align-items-center gap-3 soft-text small">
				<span>{modeTasks.filter((task) => !task.done).length} open</span>
				{#if showDone}
					<button class="toolbar-button" type="button" onclick={clearDoneForMode}>Clear done</button>
				{/if}
			</div>
			<button class="btn btn-brand" type="button" onclick={openActionModal}>
				<i class="fa-solid fa-plus me-2"></i>Add Action
			</button>
		</div>

		{#if searchOpen}
			<div class="mb-4 d-flex align-items-center gap-2">
				<input
					bind:this={searchInput}
					class="form-control"
					type="text"
					bind:value={search}
					placeholder="Search actions"
				/>
				<button class="toolbar-button" type="button" onclick={closeSearch}>Close</button>
			</div>
		{/if}

		{#if showDone}
			{#if completedTasks.length}
				<section
					class="mb-4"
					in:fly={{ x: panelDirection > 0 ? 72 : -72, duration: 150 }}
					out:fly={{ x: panelDirection > 0 ? 56 : -56, duration: 120 }}
				>
					<div class="list-heading">Completed Actions</div>
					<div class="task-list">
						{#each completedTasks as task}
							<TaskRow {task} />
						{/each}
					</div>
				</section>
			{:else}
				<div class="empty-state">No completed actions for this mode.</div>
			{/if}
		{:else}
			<div
				in:fly={{ x: panelDirection < 0 ? -72 : 72, duration: 150 }}
				out:fly={{ x: panelDirection < 0 ? -56 : 56, duration: 120 }}
			>
				{#if activeActions.length}
					<section class="mb-4">
						<div class="task-list">
							{#each activeActions as task}
								<TaskRow {task} />
							{/each}
						</div>
					</section>
				{/if}

				{#if pausedActions.length}
					<section class="mb-4" bind:this={pausedSection}>
						<div class="list-heading">Paused Actions</div>
						<div class="task-list">
							{#each pausedActions as task}
								<TaskRow {task} />
							{/each}
						</div>
					</section>
				{/if}

				{#if !activeActions.length && !pausedActions.length}
					<div class="empty-state">No open actions for this mode.</div>
				{/if}
			</div>
		{/if}
	</section>

	{#if !showDone && completedTasks.length}
		<button
			class="view-toggle-button view-toggle-right"
			type="button"
			aria-label="Show completed actions"
			data-tooltip="Show completed actions"
			onclick={openCompletedView}
		>
			<i class="fa-solid fa-check-double"></i>
		</button>
	{/if}

	{#if showDone}
		<button
			class="view-toggle-button view-toggle-left"
			type="button"
			aria-label="Show pending actions"
			data-tooltip="Show pending actions"
			onclick={openPendingView}
		>
			<i class="fa-solid fa-list"></i>
		</button>
	{/if}

	{#if showPausedJump}
		<button
			class="view-toggle-button paused-jump-button"
			type="button"
			aria-label="Jump to paused actions"
			data-tooltip="Jump to paused actions"
			onclick={jumpToPaused}
		>
			<i class="fa-solid fa-pause"></i>
		</button>
	{/if}
</div>

{#if actionModalOpen}
	<div
		class="pause-modal-backdrop"
		role="button"
		tabindex="0"
		aria-label="Close add action modal"
		onclick={closeActionModal}
		onkeydown={(event) => event.target === event.currentTarget && ['Enter', ' ', 'Escape'].includes(event.key) && closeActionModal()}
	>
		<div
			class="pause-modal action-capture-modal"
			role="dialog"
			aria-modal="true"
			aria-labelledby="add-action-title"
			tabindex="0"
			onclick={(event) => event.stopPropagation()}
			onkeydown={(event) => event.key === 'Escape' && closeActionModal()}
		>
			<div class="d-flex justify-content-between align-items-start gap-3 mb-3">
				<div>
					<div class="section-label">Quick Capture</div>
					<h2 class="h6 mt-2 mb-1" id="add-action-title">Add Actions</h2>
					<p class="soft-text small mb-0">One line per action. The current mode will be used automatically.</p>
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
					placeholder={`Finish stand-up notes\nCall bank for KYC update\nPick up medicines on the way home`}
					oninput={handleActionDraftInput}
					onkeydown={handleActionDraftKeydown}
				></textarea>
			</div>

			{#if actionDatePreviews.length}
				<div class="date-detection-stack mt-3">
					{#each actionDatePreviews as preview}
						<div class="soft-text small">
							Line {preview.index + 1}: date detected for {formatDetectedDate(preview.match.dueDate)}. Press Escape on the highlighted date to keep it as text.
						</div>
					{/each}
				</div>
			{/if}

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
