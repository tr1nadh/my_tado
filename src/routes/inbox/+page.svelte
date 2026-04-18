<script>
	import { onDestroy, onMount, tick } from 'svelte';
	import { flip } from 'svelte/animate';
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
	import ZenProgress from '$lib/components/ZenProgress.svelte';
	import { activeMode, addTask, clearDoneForMode, getModeIcon, modeColorMap, modeIcons, modeMatches, modes, tasks, updateSettings } from '$lib/tasks';

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
	$: showModeBadge = $activeMode === 'All Modes';
	$: modalSearchedTasks = modeTasks.filter((task) => {
		const matchesSearch =
			!search ||
			task.title.toLowerCase().includes(search.toLowerCase());

		return matchesSearch;
	});
	$: openTasks = modeTasks.filter((task) => !task.done);
	$: activeActions = openTasks.filter((task) => !task.paused);
	$: pausedActions = openTasks.filter((task) => task.paused);
	$: completedTasks = modeTasks.filter((task) => task.done);
	$: actionCount = actionDraft
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean).length;
	$: showPausedJump = !showDone && pausedActions.length > 0 && (!pausedSection || !pausedVisible);
	$: inboxTotalCount = modeTasks.length;
	$: inboxDoneCount = completedTasks.length;
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

	onDestroy(() => pausedObserver?.disconnect());
</script>

<div class="actions-panel-shell">
	<div class="actions-main-column" style="display: flex; flex-direction: column; gap: 1.5rem;">
		<div class="today-subtle-selector-shell" style="margin-bottom: 0;">
			<div class="today-subtle-mode-display">
				<i class="fa-solid {getModeIcon($activeMode, $modeIcons)} me-2" style="font-size: 0.9em; opacity: 0.7;"></i>
				{$activeMode} <i class="fa-solid fa-chevron-down ms-1" style="font-size: 0.75em; opacity: 0.6; margin-top: 2px;"></i>
			</div>
			<div class="today-subtle-modes-dropdown">
				{#each $modes as mode}
					<button 
						class="mode-pill {$activeMode === mode ? 'active' : ''}" 
						onclick={() => { activeMode.set(mode); updateSettings({ modeTimeBlocksEnabled: false }); }}
						style="padding: 0.4rem 0.85rem;"
					>
						<i class="fa-solid {getModeIcon(mode, $modeIcons)}" style="font-size: 0.8rem; opacity: 0.7;"></i>
						<span class="mode-pill-label" style="font-size: 0.8rem;">{mode}</span>
					</button>
				{/each}
			</div>
		</div>

		<section class="glass-panel rounded-4 p-4 fade-up" style="flex-grow: 1;">
		<div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
			<div class="d-flex align-items-center gap-3 soft-text small">
				<ZenProgress completed={inboxDoneCount} total={inboxTotalCount} size={36} />
				{#if showDone}
					<button class="toolbar-button" type="button" onclick={clearDoneForMode}>Clear done</button>
				{/if}
			</div>
			<div class="d-flex align-items-center gap-2">
				<button class="icon-button search-launch-button" type="button" aria-label="Search actions" onclick={openSearch}>
					<i class="fa-solid fa-magnifying-glass"></i>
				</button>
				<button class="btn btn-brand" type="button" aria-label="Add Action" onclick={openActionModal} style="width: 2.4rem; height: 2.4rem; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 0.7rem;">
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
					<div class="list-heading">Completed Actions</div>
					<div class="task-list">
						{#each completedTasks as task (task.id)}
							<div class="task-reorder-item" animate:flip={{ duration: 180 }}>
								<TaskRow {task} disableOptions={searchOpen} {showModeBadge} />
							</div>
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
							{#each activeActions as task (task.id)}
								<div class="task-reorder-item" animate:flip={{ duration: 180 }}>
									<TaskRow {task} disableOptions={searchOpen} {showModeBadge} />
								</div>
							{/each}
						</div>
					</section>
				{/if}

				{#if pausedActions.length}
					<section class="mb-4" bind:this={pausedSection}>
						<div class="list-heading">Paused Actions</div>
						<div class="task-list">
							{#each pausedActions as task (task.id)}
								<div class="task-reorder-item" animate:flip={{ duration: 180 }}>
									<TaskRow {task} disableOptions={searchOpen} {showModeBadge} />
								</div>
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
	</div>

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
					<div class="d-flex align-items-center gap-2 mt-2">
						{#if $activeMode !== 'All Modes'}
							<div class="active-mode-badge" style={`background: ${modeColorMap[$activeMode] || modeColorMap.Default}; padding: 0.2rem 0.6rem; font-size: 0.75rem;`}>
								<i class="fa-solid {getModeIcon($activeMode, $modeIcons)}"></i>
								{$activeMode}
							</div>
						{/if}
						<h2 class="h6 mb-0" id="add-action-title">Add Actions</h2>
					</div>
					<p class="soft-text small mb-0 mt-1">One line per action. The current mode will be used automatically.</p>
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
		onkeydown={(event) => event.target === event.currentTarget && ['Enter', ' ', 'Escape'].includes(event.key) && closeSearch()}
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
					<h2 class="h6 mt-2 mb-1" id="search-actions-title-inbox">Search Actions</h2>
					<p class="soft-text small mb-0">Search inside the current All Actions view.</p>
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
					<div class="empty-state">Start typing to search actions in All Actions.</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
