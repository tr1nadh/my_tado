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
	let listTab = 'open'; // 'open' | 'paused'
	export let open = false;
	export let closePanel = () => {};
	export let isMainView = false;

	$: showModeBadge = $activeMode === 'All Modes';
	$: scopedTasks = $tasks.filter((task) => modeMatches(task, $activeMode));
	$: modalSearchedTasks = scopedTasks.filter((task) => {
		if (!search) return true;
		return task.title.toLowerCase().includes(search.toLowerCase());
	});
	$: openTasks = scopedTasks.filter((task) => !task.done);
	$: activeOpenTasks = openTasks.filter((t) => !t.paused);
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
		listTab = 'open';
	}

	$: if (!showDone && listTab === 'open' && !activeOpenTasks.length && pausedActions.length) {
		listTab = 'paused';
	}
	$: if (!showDone && listTab === 'paused' && !pausedActions.length && activeOpenTasks.length) {
		listTab = 'open';
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

<div class="all-panel">
	<header class="all-header">
		<div class="all-title-row">
			<div>
				<h2 class="all-title">All</h2>
				<p class="all-subtitle">Everything in the selected mode. Use the top mode bar to switch context.</p>
			</div>
			<div class="all-title-actions">
				<button
					class="icon-button search-launch-button"
					type="button"
					aria-label="Search actions"
					onclick={openSearch}
				>
					<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
				</button>
				<button class="all-add" type="button" aria-label="Add action" onclick={openActionModal}>
					<i class="fa-solid fa-plus" aria-hidden="true"></i>
				</button>
				{#if !isMainView}
					<button class="all-close" type="button" aria-label="Close all panel" onclick={closePanel}>
						<i class="fa-solid fa-xmark" aria-hidden="true"></i>
					</button>
				{/if}
			</div>
		</div>

		<div class="all-toolbar">
			<div class="all-meta">
				{#if !showDone}
					<div class="all-tabs" role="tablist" aria-label="All tabs">
						<button
							type="button"
							class="all-tab {listTab === 'open' ? 'active' : ''}"
							role="tab"
							aria-selected={listTab === 'open'}
							onclick={() => (listTab = 'open')}
						>
							Open <span class="all-tab-count">{activeOpenTasks.length}</span>
						</button>
						<button
							type="button"
							class="all-tab {listTab === 'paused' ? 'active' : ''}"
							role="tab"
							aria-selected={listTab === 'paused'}
							onclick={() => (listTab = 'paused')}
						>
							Paused <span class="all-tab-count">{pausedActions.length}</span>
						</button>
					</div>

					{#if completedTasks.length}
						<button class="all-toggle" type="button" onclick={openCompletedView}>
							Completed ({completedTasks.length})
						</button>
					{/if}
				{:else}
					<button class="all-toggle" type="button" onclick={openPendingView}>Back</button>
					<button class="all-toggle danger" type="button" onclick={clearDoneForMode}>Clear done</button>
				{/if}
			</div>

		</div>
	</header>

	<div class="all-content">
		{#if showDone}
			{#if completedTasks.length}
				<section
					class="all-section"
					in:fly={{ x: panelDirection > 0 ? 72 : -72, duration: 150 }}
					out:fly={{ x: panelDirection > 0 ? 56 : -56, duration: 120 }}
				>
					<div class="all-section-heading">Completed</div>
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
				{#if listTab === 'open'}
					{#if activeOpenTasks.length}
						<section class="all-section all-section-flat">
							<div class="task-list">
								{#each activeOpenTasks as task (task.id)}
									<div class="task-reorder-item" animate:flip={{ duration: 180 }}>
										<TaskRow {task} disableOptions={searchOpen} {showModeBadge} />
									</div>
								{/each}
							</div>
						</section>
					{:else}
						<div class="empty-state">{pausedActions.length ? 'No open actions. Check Paused.' : 'All is clear for this mode.'}</div>
					{/if}
				{:else}
					{#if pausedActions.length}
						<section class="all-section all-section-flat">
							<div class="task-list">
								{#each pausedActions as task (task.id)}
									<div class="task-reorder-item" animate:flip={{ duration: 180 }}>
										<TaskRow {task} disableOptions={searchOpen} {showModeBadge} />
									</div>
								{/each}
							</div>
						</section>
					{:else}
						<div class="empty-state">No paused actions right now.</div>
					{/if}
				{/if}
			</div>
		{/if}
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
					<h2 class="h6 mb-0" id="add-action-title-inbox">Add to All</h2>
					</div>
					<p class="soft-text small mb-0 mt-1">
						Lines without a date stay in All. Natural-language dates are detected automatically.
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
					<h2 class="h6 mt-2 mb-1" id="search-actions-title-inbox">Search All</h2>
					<p class="soft-text small mb-0">Search inside the current All view.</p>
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
					<div class="empty-state">Start typing to search All.</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.all-panel {
		height: 100%;
		display: flex;
		flex-direction: column;
		background:
			radial-gradient(circle at top left, rgba(37, 112, 215, 0.18), transparent 42%),
			linear-gradient(165deg, rgba(7, 17, 32, 0.96), rgba(6, 12, 24, 0.98));
		border: none;
		border-radius: 0;
		overflow: hidden;
	}

	.all-header {
		padding: 0.9rem 1rem 0.78rem;
		border-bottom: 1px solid rgba(133, 188, 255, 0.14);
		background: rgba(255, 255, 255, 0.02);
		display: grid;
		gap: 0.7rem;
	}

	.all-title-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.all-title-actions {
		display: inline-flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.45rem;
		flex-shrink: 0;
	}

	.all-title {
		margin: 0;
		font-size: 1.16rem;
		font-weight: 650;
		color: var(--text);
	}

	.all-subtitle {
		margin: 0.2rem 0 0;
		color: var(--muted);
		font-size: 0.8rem;
		max-width: 36ch;
	}

	.all-close {
		width: 2rem;
		height: 2rem;
		border-radius: 0.62rem;
		border: 1px solid rgba(133, 188, 255, 0.2);
		background: rgba(255, 255, 255, 0.06);
		color: var(--muted);
		cursor: pointer;
		transition: all 0.2s ease;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.all-close:hover {
		border-color: rgba(255, 107, 129, 0.38);
		background: rgba(255, 107, 129, 0.16);
		color: #ff6b81;
	}

	.all-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
		flex-wrap: wrap;
	}

	.all-meta {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		flex-wrap: wrap;
	}

	.all-tabs {
		display: inline-flex;
		align-items: center;
		gap: 0.15rem;
		padding: 0.16rem;
		border-radius: 999px;
		border: 1px solid rgba(133, 188, 255, 0.18);
		background: rgba(255, 255, 255, 0.04);
	}

	.all-tab {
		border: 0;
		background: transparent;
		color: var(--muted);
		border-radius: 999px;
		padding: 0.36rem 0.7rem;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		cursor: pointer;
		transition: background 0.2s ease, color 0.2s ease;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		white-space: nowrap;
	}

	.all-tab:hover {
		background: rgba(255, 255, 255, 0.08);
		color: var(--text);
	}

	.all-tab.active {
		background: rgba(45, 127, 249, 0.18);
		color: var(--text);
	}

	.all-tab-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.5rem;
		height: 1.2rem;
		padding: 0 0.45rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.08);
		color: var(--text);
		font-size: 0.74rem;
		font-weight: 700;
	}

	.all-toggle {
		border: 1px solid rgba(133, 188, 255, 0.2);
		background: rgba(255, 255, 255, 0.06);
		color: var(--text);
		border-radius: 0.62rem;
		padding: 0.34rem 0.6rem;
		font-size: 0.76rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.all-toggle:hover {
		background: rgba(255, 255, 255, 0.12);
	}

	.all-toggle.danger {
		border-color: rgba(255, 107, 129, 0.3);
		color: #ff9aa9;
	}

	.all-add {
		width: 2.1rem;
		height: 2.1rem;
		border: 1px solid rgba(117, 212, 255, 0.36);
		border-radius: 0.64rem;
		background: linear-gradient(145deg, rgba(77, 166, 255, 0.92), rgba(67, 106, 227, 0.95));
		color: #fff;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.all-add:hover {
		filter: brightness(1.06);
		box-shadow: 0 8px 16px rgba(41, 107, 206, 0.3);
	}

	.all-content {
		flex: 1;
		overflow-y: auto;
		padding: 0.82rem 0.96rem 0.96rem;
	}

	.all-section {
		margin-bottom: 0.72rem;
		padding: 0.66rem;
		border-radius: 0.8rem;
		border: 1px solid rgba(133, 188, 255, 0.14);
		background: rgba(255, 255, 255, 0.03);
	}

	.all-section-flat {
		border: 0;
		background: transparent;
		padding: 0;
		margin-bottom: 0;
	}

	.all-section-heading {
		font-size: 0.76rem;
		font-weight: 650;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--cyan);
		margin-bottom: 0.5rem;
	}

	@media (max-width: 640px) {
		.all-panel {
			border-radius: 0;
		}

		.all-header {
			padding: 0.75rem 0.78rem 0.7rem;
			gap: 0.6rem;
		}

		.all-title {
			font-size: 1.02rem;
		}

		.all-subtitle {
			font-size: 0.75rem;
			max-width: none;
		}

		.all-toolbar {
			gap: 0.65rem;
		}

		.all-content {
			padding: 0.66rem 0.72rem 0.74rem;
		}

		.all-section {
			padding: 0.54rem;
		}
	}
</style>
