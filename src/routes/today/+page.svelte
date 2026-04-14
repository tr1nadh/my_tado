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
	import {
		activeMode,
		addTask,
		clearDoneForMode,
		isOverdue,
		isToday,
		modeMatches,
		pauseTask,
		rescheduleTasksToToday,
		resumeTask,
		settings,
		settingsReady,
		toggleTask,
		tasks
	} from '$lib/tasks';

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
	let focusMode = false;
	let focusIndex = 0;
	let focusPauseModalOpen = false;
	let focusPauseReasonDraft = '';
	const todayDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

	const matrixTabs = [
		'All',
		'Urgent and Important',
		'Urgent and not important',
		'Important and not urgent',
		'Not urgent and not important'
	];
	let selectedMatrixTab = 'All';

	$: scopedTasks = $tasks.filter((task) => modeMatches(task, $activeMode) && (isToday(task.dueDate) || isOverdue(task.dueDate)));
	$: matrixScopedTasks =
		!$settings.enableMatrixCategories || selectedMatrixTab === 'All'
			? scopedTasks
			: scopedTasks.filter((task) => task.matrixType === selectedMatrixTab);
	$: modalSearchedTasks = matrixScopedTasks.filter((task) => {
		const matchesSearch =
			!search ||
			task.title.toLowerCase().includes(search.toLowerCase());

		return matchesSearch;
	});
	$: overdueTasks = matrixScopedTasks.filter((task) => !task.done && isOverdue(task.dueDate));
	$: todayTasks = matrixScopedTasks.filter((task) => !task.done && isToday(task.dueDate));
	$: pausedActions = matrixScopedTasks.filter((task) => !task.done && task.paused);
	$: overdueActiveActions = overdueTasks.filter((task) => !task.paused);
	$: todayActiveActions = todayTasks.filter((task) => !task.paused);
	$: focusActions = [...overdueTasks, ...todayTasks];
	$: if (!focusActions.length) {
		focusIndex = 0;
		focusMode = false;
	} else if (focusIndex > focusActions.length - 1) {
		focusIndex = focusActions.length - 1;
	}
	$: activeFocusTask = focusActions[focusIndex] || null;
	$: if (!focusPauseModalOpen) {
		focusPauseReasonDraft = activeFocusTask?.pauseReason || '';
	}
	$: completedTasks = matrixScopedTasks.filter((task) => task.done);
	$: actionCount = actionDraft
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean).length;
	$: showPausedJump = !showDone && pausedActions.length > 0 && (!pausedSection || !pausedVisible);
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
				return {
					title,
					dueDate: match?.dueDate || todayDate
				};
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

	function toggleFocusMode() {
		focusMode = !focusMode;
		if (focusMode) {
			showDone = false;
			focusIndex = 0;
		}
	}

	function showPrevFocus() {
		if (!focusActions.length) return;
		focusIndex = (focusIndex - 1 + focusActions.length) % focusActions.length;
	}

	function showNextFocus() {
		if (!focusActions.length) return;
		focusIndex = (focusIndex + 1) % focusActions.length;
	}

	function completeFocusTask() {
		if (!activeFocusTask) return;
		const currentIndex = focusIndex;
		toggleTask(activeFocusTask.id);

		if (focusActions.length <= 1) {
			focusMode = false;
			focusIndex = 0;
			return;
		}

		focusIndex = Math.min(currentIndex, focusActions.length - 2);
	}

	function pauseFocusTask() {
		if (!activeFocusTask) return;
		pauseTask(activeFocusTask.id, '');
	}

	function openFocusPauseReason() {
		if (!activeFocusTask) return;
		focusPauseReasonDraft = activeFocusTask.pauseReason || '';
		focusPauseModalOpen = true;
	}

	function saveFocusPauseReason() {
		if (!activeFocusTask) return;
		pauseTask(activeFocusTask.id, focusPauseReasonDraft);
		focusPauseModalOpen = false;
	}

	function resumeFocusTask() {
		if (!activeFocusTask) return;
		resumeTask(activeFocusTask.id);
	}

	function jumpToPaused() {
		pausedSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function rescheduleOverdueToToday() {
		rescheduleTasksToToday(overdueActiveActions.map((task) => task.id));
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
				if (focusPauseModalOpen) {
					focusPauseModalOpen = false;
					return;
				}
				if (searchOpen) closeSearch();
				showDone = false;
				focusMode = false;
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
	<section class="glass-panel rounded-4 p-4 fade-up">
		<div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
			<div class="d-flex align-items-center gap-3 soft-text small">
				<span>{matrixScopedTasks.filter((task) => !task.done && !task.paused).length} open</span>
				{#if pausedActions.length}
					<span>{pausedActions.length} paused</span>
				{/if}
				{#if overdueTasks.length}
					<span>{overdueTasks.length} overdue</span>
				{/if}
				{#if showDone}
					<button class="toolbar-button" type="button" onclick={clearDoneForMode}>Clear done</button>
				{/if}
			</div>
			<div class="d-flex flex-wrap align-items-center gap-2">
				<button class="icon-button search-launch-button" type="button" aria-label="Search actions" onclick={openSearch}>
					<i class="fa-solid fa-magnifying-glass"></i>
				</button>
				<button class={`toolbar-button ${focusMode ? 'active' : ''}`} type="button" onclick={toggleFocusMode}>
					<i class="fa-solid fa-bullseye me-2"></i>{focusMode ? 'Exit focus' : 'Focus mode'}
				</button>
				<button class="btn btn-brand" type="button" onclick={openActionModal}>
					<i class="fa-solid fa-plus me-2"></i>Add Action
				</button>
			</div>
		</div>

		{#if $settingsReady && $settings.enableMatrixCategories}
			<div class="matrix-tabs mb-4" role="tablist" aria-label="Today action categories">
				{#each matrixTabs as matrixTab}
					<button
						class={`matrix-tab-button ${selectedMatrixTab === matrixTab ? 'active' : ''}`}
						type="button"
						role="tab"
						aria-selected={selectedMatrixTab === matrixTab}
						onclick={() => {
							selectedMatrixTab = matrixTab;
							focusIndex = 0;
						}}
					>
						<span>{matrixTab}</span>
						<span class="matrix-tab-count">
							{matrixTab === 'All'
								? scopedTasks.filter((task) => !task.done).length
								: scopedTasks.filter((task) => task.matrixType === matrixTab && !task.done).length}
						</span>
					</button>
				{/each}
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
							{#each completedTasks as task (task.id)}
								<div class="task-reorder-item" animate:flip={{ duration: 180 }}>
									<TaskRow
										{task}
										disableOptions={searchOpen}
										showTypeBadge={$settingsReady && $settings.enableMatrixCategories && selectedMatrixTab === 'All'}
									/>
								</div>
							{/each}
						</div>
				</section>
			{:else}
				<div class="empty-state">
					{!$settings.enableMatrixCategories || selectedMatrixTab === 'All'
						? 'No completed actions right now.'
						: 'No completed actions in this category.'}
				</div>
			{/if}
		{:else if focusMode}
			<div class="empty-state">Focus mode is active.</div>
		{:else}
			<div
				in:fly={{ x: panelDirection < 0 ? -72 : 72, duration: 150 }}
				out:fly={{ x: panelDirection < 0 ? -56 : 56, duration: 120 }}
			>
				{#if overdueActiveActions.length}
					<section class="mb-4">
						<div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
							<div class="list-heading mb-0">Overdue</div>
							<button class="toolbar-button" type="button" onclick={rescheduleOverdueToToday}>
								Reschedule to today
							</button>
						</div>
						<div class="task-list">
							{#each overdueActiveActions as task (task.id)}
								<div class="task-reorder-item" animate:flip={{ duration: 180 }}>
									<TaskRow
										{task}
										disableOptions={searchOpen}
										showTypeControls={$settingsReady && $settings.enableMatrixCategories}
										showTypeBadge={$settingsReady && $settings.enableMatrixCategories && selectedMatrixTab === 'All'}
									/>
								</div>
							{/each}
						</div>
					</section>
				{/if}

				<section>
					<div class="list-heading">Today</div>
					<div class="task-list">
						{#if todayActiveActions.length}
							{#each todayActiveActions as task (task.id)}
								<div class="task-reorder-item" animate:flip={{ duration: 180 }}>
									<TaskRow
										{task}
										disableOptions={searchOpen}
										showTypeControls={$settingsReady && $settings.enableMatrixCategories}
										showTypeBadge={$settingsReady && $settings.enableMatrixCategories && selectedMatrixTab === 'All'}
									/>
								</div>
							{/each}
						{:else}
							<div class="empty-state">
								{!$settings.enableMatrixCategories || selectedMatrixTab === 'All'
									? 'No actions for today.'
									: 'No actions in this category for today.'}
							</div>
						{/if}
					</div>
				</section>

				{#if pausedActions.length}
					<section class="mt-4" bind:this={pausedSection}>
						<div class="list-heading">Paused Actions</div>
						<div class="task-list">
							{#each pausedActions as task (task.id)}
								<div class="task-reorder-item" animate:flip={{ duration: 180 }}>
									<TaskRow
										{task}
										disableOptions={searchOpen}
										showTypeControls={$settingsReady && $settings.enableMatrixCategories}
										showTypeBadge={$settingsReady && $settings.enableMatrixCategories && selectedMatrixTab === 'All'}
									/>
								</div>
							{/each}
						</div>
					</section>
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

{#if focusMode}
	<div class="focus-overlay" role="dialog" aria-modal="true" aria-labelledby="focus-mode-title">
		<div class="focus-overlay-backdrop"></div>
		<div class="focus-overlay-content">
			<div class="focus-overlay-exit">
				<button class="focus-exit-button" type="button" aria-label="Exit focus mode" onclick={() => (focusMode = false)}>
					<i class="fa-solid fa-xmark"></i>
				</button>
				<span class="focus-exit-label">ESC</span>
			</div>

			<div class="focus-overlay-head">
				<div>
					{#if activeFocusTask}
						<div class="focus-mode-badge mode" id="focus-mode-title">{activeFocusTask.mode}</div>
					{:else}
						<div class="focus-mode-badge mode" id="focus-mode-title">Focus Mode</div>
					{/if}
				</div>
			</div>

			{#if activeFocusTask}
				<div class="focus-overlay-body">
					<div class="focus-overlay-count">
						<span class="focus-overlay-count-number">{focusIndex + 1} / {focusActions.length}</span>
					</div>

					<div class="focus-overlay-stage">
						<button class="focus-nav-button" type="button" aria-label="Previous action" onclick={showPrevFocus}>
							<i class="fa-solid fa-chevron-left"></i>
						</button>

						<div class="focus-overlay-center">
							<div class="focus-overlay-task">
								{activeFocusTask.paused && activeFocusTask.pauseReason ? activeFocusTask.pauseReason : activeFocusTask.title}
							</div>

							{#if activeFocusTask.dueDate}
								<div class="task-due-note focus-overlay-due">
									<i class="fa-regular fa-calendar me-2"></i>{formatDetectedDate(activeFocusTask.dueDate)}
								</div>
							{/if}

							<div class="focus-overlay-actions">
								<button class="btn btn-brand focus-complete-button" type="button" onclick={completeFocusTask}>
									<i class="fa-solid fa-check me-2"></i>Complete
								</button>
								{#if activeFocusTask.paused}
									<button class="toolbar-button focus-pause-button" type="button" onclick={resumeFocusTask}>
										<i class="fa-solid fa-play me-2"></i>Resume
									</button>
									<button class="toolbar-button focus-pause-button" type="button" onclick={openFocusPauseReason}>
										<i class="fa-solid fa-comment-dots me-2"></i>{activeFocusTask.pauseReason ? 'Edit reason' : 'Add reason'}
									</button>
								{:else}
									<button class="toolbar-button focus-pause-button" type="button" onclick={pauseFocusTask}>
										<i class="fa-solid fa-pause me-2"></i>Pause
									</button>
								{/if}
							</div>
						</div>

						<button class="focus-nav-button" type="button" aria-label="Next action" onclick={showNextFocus}>
							<i class="fa-solid fa-chevron-right"></i>
						</button>
					</div>
				</div>
			{:else}
				<div class="empty-state">No actions in this category right now.</div>
			{/if}
		</div>
	</div>
{/if}

{#if focusPauseModalOpen && activeFocusTask}
	<div
		class="pause-modal-backdrop focus-pause-layer"
		role="button"
		tabindex="0"
		aria-label="Close focus pause modal"
		onclick={() => (focusPauseModalOpen = false)}
		onkeydown={(event) => event.target === event.currentTarget && ['Enter', ' ', 'Escape'].includes(event.key) && (focusPauseModalOpen = false)}
	>
		<div
			class="pause-modal"
			role="dialog"
			aria-modal="true"
			aria-labelledby="focus-pause-modal-title"
			tabindex="0"
			onclick={(event) => event.stopPropagation()}
			onkeydown={(event) => event.key === 'Escape' && (focusPauseModalOpen = false)}
		>
			<div class="d-flex justify-content-between align-items-start gap-3 mb-3">
				<div>
					<div class="section-label">Pause Action</div>
					<h2 class="h6 mt-2 mb-1" id="focus-pause-modal-title">{activeFocusTask.title}</h2>
					<p class="soft-text small mb-0">Optional: add the blocker or reason so the focused action can carry that context.</p>
				</div>
			</div>

			<label class="form-label soft-text" for="focus-pause-reason">Why is this paused?</label>
			<textarea
				id="focus-pause-reason"
				class="form-control"
				rows="4"
				bind:value={focusPauseReasonDraft}
				placeholder="Example: Waiting for the client to confirm the final time before I can continue."
			></textarea>

			<div class="d-flex justify-content-end gap-2 mt-3">
				<button class="toolbar-button" type="button" onclick={() => (focusPauseModalOpen = false)}>Cancel</button>
				<button class="toolbar-button active" type="button" onclick={saveFocusPauseReason}>Save reason</button>
			</div>
		</div>
	</div>
{/if}

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
			aria-labelledby="add-action-title-today"
			tabindex="0"
			onclick={(event) => event.stopPropagation()}
			onkeydown={(event) => event.key === 'Escape' && closeActionModal()}
		>
			<div class="d-flex justify-content-between align-items-start gap-3 mb-3">
				<div>
					<div class="section-label">Quick Capture</div>
					<h2 class="h6 mt-2 mb-1" id="add-action-title-today">Add Actions</h2>
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
			aria-labelledby="search-actions-title-today"
			tabindex="0"
			onclick={(event) => event.stopPropagation()}
			onkeydown={(event) => event.key === 'Escape' && closeSearch()}
		>
			<div class="d-flex justify-content-between align-items-start gap-3 mb-3">
				<div>
					<div class="section-label">Search</div>
					<h2 class="h6 mt-2 mb-1" id="search-actions-title-today">Search Actions</h2>
					<p class="soft-text small mb-0">Search inside the current Today view.</p>
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
					<div class="soft-text small mb-2">{modalSearchedTasks.length} match{modalSearchedTasks.length === 1 ? '' : 'es'}</div>
					{#if modalSearchedTasks.length}
						<div class="search-results-list task-list">
							{#each modalSearchedTasks as task (task.id)}
								<div class="search-result-row">
									<TaskRow
										{task}
										showTypeControls={$settingsReady && $settings.enableMatrixCategories}
										showTypeBadge={$settingsReady && $settings.enableMatrixCategories && selectedMatrixTab === 'All'}
									/>
								</div>
							{/each}
						</div>
					{:else}
						<div class="empty-state">No actions match this search.</div>
					{/if}
				{:else}
					<div class="empty-state">Start typing to search actions in Today.</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
