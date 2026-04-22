<script>
	import { onDestroy, onMount, tick } from 'svelte';
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
	import { activeMode, addTask, clearDoneForMode, getModeIcon, modeColorMap, modeIcons, modeMatches, tasks } from '$lib/tasks';

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
	export let open = false;
	export let closePanel = () => {};
	export let isMainView = false;

	let rangeFilter = 'next7';
	let quickFilter = 'all';
	let customStart = '';
	let customEnd = '';
	let customRangeModalOpen = false;

	const rangeOptions = [
		{ value: 'next7', label: 'Next 7 days' },
		{ value: 'next14', label: 'Next 14 days' },
		{ value: 'thisMonth', label: 'This month' },
		{ value: 'custom', label: 'Custom' }
	];

	const quickFilterOptions = [
		{ value: 'all', label: 'All' },
		{ value: 'today', label: 'Today' },
		{ value: 'tomorrow', label: 'Tomorrow' },
		{ value: 'weekend', label: 'This weekend' },
		{ value: 'overdue', label: 'Overdue' },
		{ value: 'noDate', label: 'No date' }
	];

	function formatDateValue(date) {
		return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
	}

	function getTodayDate() {
		const date = new Date();
		date.setHours(0, 0, 0, 0);
		return date;
	}

	function parseDateValue(value) {
		if (!value) return null;
		const [year, month, day] = String(value)
			.split('-')
			.map((part) => Number.parseInt(part, 10));
		if (!year || !month || !day) return null;
		const parsed = new Date(year, month - 1, day);
		parsed.setHours(0, 0, 0, 0);
		return parsed;
	}

	function addDays(dateValue, days) {
		const next = new Date(dateValue);
		next.setDate(next.getDate() + days);
		return next;
	}

	function getTodayKey() {
		return formatDateValue(getTodayDate());
	}

	function isWeekendDateKey(value) {
		const parsed = parseDateValue(value);
		if (!parsed) return false;
		const day = parsed.getDay();
		return day === 0 || day === 6;
	}

	function getRelativeDateLabel(value) {
		if (!value) return '';
		const todayKey = getTodayKey();
		const tomorrowKey = formatDateValue(addDays(getTodayDate(), 1));
		if (value === todayKey) return 'Today';
		if (value === tomorrowKey) return 'Tomorrow';
		if (value < todayKey) return 'Overdue';
		return '';
	}

	function formatGroupLabel(value) {
		const parsed = parseDateValue(value);
		if (!parsed) return 'No date';
		return parsed.toLocaleDateString('en-IN', {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	}

	function ensureCustomRangeDefaults() {
		const today = getTodayDate();
		if (!customStart) customStart = formatDateValue(today);
		if (!customEnd) customEnd = formatDateValue(addDays(today, 6));
	}

	function openCustomRangePicker() {
		ensureCustomRangeDefaults();
		customRangeModalOpen = true;
	}

	function applyCustomRange() {
		ensureCustomRangeDefaults();
		const start = parseDateValue(customStart);
		const end = parseDateValue(customEnd);
		if (start && end && start > end) {
			[customStart, customEnd] = [customEnd, customStart];
		}
		rangeFilter = 'custom';
		customRangeModalOpen = false;
	}

	function selectRange(value) {
		if (value === 'custom') {
			openCustomRangePicker();
			return;
		}
		rangeFilter = value;
	}

	function resetUpcomingFilters() {
		rangeFilter = 'next7';
		quickFilter = 'all';
		search = '';
		showDone = false;
	}

	function getRangeBounds() {
		const today = getTodayDate();
		const todayKey = formatDateValue(today);

		if (rangeFilter === 'next14') {
			return { start: todayKey, end: formatDateValue(addDays(today, 13)) };
		}

		if (rangeFilter === 'thisMonth') {
			const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
			const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
			return { start: formatDateValue(monthStart), end: formatDateValue(monthEnd) };
		}

		if (rangeFilter === 'custom') {
			ensureCustomRangeDefaults();
			return { start: customStart, end: customEnd };
		}

		return { start: todayKey, end: formatDateValue(addDays(today, 6)) };
	}

	function taskMatchesDateFilter(task) {
		const dueDate = String(task.dueDate || '').trim();
		const todayKey = getTodayKey();
		const tomorrowKey = formatDateValue(addDays(getTodayDate(), 1));
		const { start, end } = getRangeBounds();

		if (quickFilter === 'noDate') return !dueDate;
		if (!dueDate) return false;

		if (quickFilter === 'overdue') return dueDate < todayKey;
		if (dueDate < start || dueDate > end) return false;

		if (quickFilter === 'today') return dueDate === todayKey;
		if (quickFilter === 'tomorrow') return dueDate === tomorrowKey;
		if (quickFilter === 'weekend') return isWeekendDateKey(dueDate);

		return true;
	}

	function groupByDueDate(list) {
		const groups = new Map();
		for (const task of list) {
			const key = String(task.dueDate || '').trim() || 'no-date';
			if (!groups.has(key)) {
				groups.set(key, []);
			}
			groups.get(key).push(task);
		}

		return [...groups.entries()]
			.sort(([left], [right]) => {
				if (left === 'no-date') return 1;
				if (right === 'no-date') return -1;
				return left.localeCompare(right);
			})
			.map(([key, tasks]) => ({
				key,
				label: key === 'no-date' ? 'No date' : formatGroupLabel(key),
				helper: key === 'no-date' ? '' : getRelativeDateLabel(key),
				tasks
			}));
	}

	function getFilterSummary() {
		const rangeLabel = rangeOptions.find((option) => option.value === rangeFilter)?.label || 'Next 7 days';
		const quickLabel = quickFilterOptions.find((option) => option.value === quickFilter)?.label || 'All';
		return `${rangeLabel} • ${quickLabel}`;
	}

	function getDefaultUpcomingDueDate() {
		const today = getTodayDate();
		if (quickFilter === 'noDate') return '';
		if (quickFilter === 'today') return formatDateValue(today);
		if (quickFilter === 'tomorrow') return formatDateValue(addDays(today, 1));
		if (quickFilter === 'weekend') {
			for (let index = 0; index < 14; index += 1) {
				const candidate = addDays(today, index);
				if (candidate.getDay() === 0 || candidate.getDay() === 6) {
					return formatDateValue(candidate);
				}
			}
			return formatDateValue(today);
		}
		if (rangeFilter === 'custom') {
			ensureCustomRangeDefaults();
			return customStart;
		}
		return formatDateValue(today);
	}

	$: showModeBadge = $activeMode === 'All Modes';
	$: normalizedSearch = search.trim().toLowerCase();
	$: scopedTasks = $tasks.filter((task) => modeMatches(task, $activeMode) && taskMatchesDateFilter(task));
	$: filteredTasks = scopedTasks.filter((task) =>
		!normalizedSearch || task.title.toLowerCase().includes(normalizedSearch)
	);
	$: openWeekTasks = filteredTasks.filter((task) => !task.done);
	$: activeOpenTasks = openWeekTasks.filter((task) => !task.paused);
	$: filteredPausedActions = openWeekTasks.filter((task) => task.paused);
	$: filteredCompletedTasks = filteredTasks.filter((task) => task.done);
	$: visibleUpcomingGroups = groupByDueDate(activeOpenTasks);
	$: actionCount = actionDraft
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean).length;
	$: showPausedJump = !showDone && filteredPausedActions.length > 0 && (!pausedSection || !pausedVisible);
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
				return { title, dueDate: match?.dueDate || getDefaultUpcomingDueDate() };
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
				if (customRangeModalOpen) customRangeModalOpen = false;
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

<div class="upcoming-redesign">
	<header class="upcoming-header">
		<div class="upcoming-top-row">
			<div class="upcoming-title-block">
				<div class="upcoming-title">
					<i class="fa-solid fa-calendar-days" aria-hidden="true"></i>
					<h2>Upcoming</h2>
				</div>
				<div class="upcoming-subtitle">Plan by week and keep the next commitments visible.</div>
			</div>
			<div class="upcoming-header-right">
				<div class="stat-card" aria-label="Open actions in this week">
					<div class="stat-number">{openWeekTasks.length}</div>
					<div class="stat-label">Planned</div>
				</div>
				{#if !isMainView}
					<button class="close-btn" type="button" aria-label="Close upcoming panel" onclick={closePanel}>
						<i class="fa-solid fa-xmark" aria-hidden="true"></i>
					</button>
				{/if}
			</div>
		</div>

		<div class="range-chip-row" role="tablist" aria-label="Date range presets">
			{#each rangeOptions as option}
				<button
					type="button"
					class={`range-chip ${rangeFilter === option.value ? 'active' : ''}`}
					onclick={() => selectRange(option.value)}
				>
					{option.label}
				</button>
			{/each}
		</div>

		<div class="quick-chip-row" aria-label="Quick date filters">
			{#each quickFilterOptions as option}
				<button
					type="button"
					class={`quick-chip ${quickFilter === option.value ? 'active' : ''}`}
					onclick={() => (quickFilter = option.value)}
				>
					{option.label}
				</button>
			{/each}
		</div>

		<div class="filter-summary-row">
			<div class="filter-summary-copy">{getFilterSummary()}</div>
			<div class="filter-summary-actions">
				{#if rangeFilter === 'custom'}
					<button class="toolbar-button-lite" type="button" onclick={openCustomRangePicker}>Edit custom</button>
				{/if}
				<button class="toolbar-button-lite" type="button" onclick={resetUpcomingFilters}>Reset filters</button>
			</div>
		</div>

		<div class="upcoming-toolbar">
			<label class="upcoming-search-shell" for="upcoming-search-input">
				<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
				<input
					id="upcoming-search-input"
					bind:this={searchInput}
					type="text"
					placeholder="Search actions in this week"
					bind:value={search}
					onfocus={() => (searchOpen = true)}
					onblur={() => (searchOpen = false)}
				/>
			</label>
			<div class="toolbar-actions">
				{#if showDone}
					<button class="toolbar-button-lite" type="button" onclick={openPendingView}>Back to open</button>
				{:else}
					<button class="toolbar-button-lite" type="button" onclick={openCompletedView}>
						Completed ({filteredCompletedTasks.length})
					</button>
				{/if}
				{#if showPausedJump}
					<button class="toolbar-button-lite" type="button" onclick={jumpToPaused}>
						Paused ({filteredPausedActions.length})
					</button>
				{/if}
				<button class="icon-btn add-btn" type="button" aria-label="Add action" onclick={openActionModal}>
					<i class="fa-solid fa-plus" aria-hidden="true"></i>
				</button>
			</div>
		</div>
	</header>

	<div class="upcoming-content">
		{#if showDone}
			<div class="content-section completed-section">
				<div class="section-header">
					<h3>Completed actions</h3>
					{#if filteredCompletedTasks.length}
						<button class="clear-btn" type="button" onclick={clearDoneForMode}>Clear done</button>
					{/if}
				</div>
				{#if filteredCompletedTasks.length}
					<div class="task-grid">
						{#each filteredCompletedTasks as task (task.id)}
							<div class="task-item" animate:flip={{ duration: 180 }}>
								<TaskRow {task} disableOptions={searchOpen} {showModeBadge} />
							</div>
						{/each}
					</div>
				{:else}
					<div class="empty-state">
						<i class="fa-solid fa-check-circle" aria-hidden="true"></i>
						<p>No completed actions in this view</p>
					</div>
				{/if}
			</div>
		{:else}
			<div class="content-section upcoming-section">
				{#if visibleUpcomingGroups.length}
					{#each visibleUpcomingGroups as group}
						<div class="day-group">
							<div class="day-header">
								<span class="day-name">{group.label}</span>
								{#if group.helper}
									<span class="day-helper">{group.helper}</span>
								{/if}
								<span class="task-count">{group.tasks.length} actions</span>
							</div>
							<div class="task-grid">
								{#each group.tasks as task (task.id)}
									<div class="task-item" animate:flip={{ duration: 180 }}>
										<TaskRow {task} disableOptions={searchOpen} {showModeBadge} />
									</div>
								{/each}
							</div>
						</div>
					{/each}
				{:else}
					<div class="empty-state">
						<i class="fa-solid fa-calendar-xmark" aria-hidden="true"></i>
						<p>No upcoming actions for this week</p>
						<span>Try another week, reset to today, or add a new action.</span>
					</div>
				{/if}

				{#if filteredPausedActions.length}
					<div class="day-group paused-group" bind:this={pausedSection}>
						<div class="day-header paused-header">
							<i class="fa-solid fa-pause-circle" aria-hidden="true"></i>
							<span>Paused</span>
							<span class="task-count">{filteredPausedActions.length} actions</span>
						</div>
						<div class="task-grid">
							{#each filteredPausedActions as task (task.id)}
								<div class="task-item paused-item" animate:flip={{ duration: 180 }}>
									<TaskRow {task} disableOptions={searchOpen} {showModeBadge} />
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

{#if customRangeModalOpen}
	<div
		class="pause-modal-backdrop custom-range-backdrop"
		role="button"
		tabindex="0"
		aria-label="Close custom date range picker"
		onclick={() => (customRangeModalOpen = false)}
		onkeydown={(event) =>
			event.target === event.currentTarget && ['Enter', ' ', 'Escape'].includes(event.key) && (customRangeModalOpen = false)}
	>
		<div
			class="pause-modal custom-range-modal"
			role="dialog"
			aria-modal="true"
			aria-labelledby="custom-range-title"
			tabindex="0"
			onclick={(event) => event.stopPropagation()}
			onkeydown={(event) => event.key === 'Escape' && (customRangeModalOpen = false)}
		>
			<div class="d-flex justify-content-between align-items-start gap-3 mb-3">
				<div>
					<div class="section-label">Custom range</div>
					<h2 class="h6 mt-2 mb-1" id="custom-range-title">Choose start and end date</h2>
					<p class="soft-text small mb-0">This range is used with your selected quick filter.</p>
				</div>
				<button class="icon-button" type="button" aria-label="Close custom range picker" onclick={() => (customRangeModalOpen = false)}>
					<i class="fa-solid fa-xmark"></i>
				</button>
			</div>

			<div class="custom-range-grid">
				<label class="settings-number-field">
					<span>Start</span>
					<input class="form-control" type="date" bind:value={customStart} />
				</label>
				<label class="settings-number-field">
					<span>End</span>
					<input class="form-control" type="date" bind:value={customEnd} />
				</label>
			</div>

			<div class="d-flex justify-content-end gap-2 mt-3">
				<button class="toolbar-button" type="button" onclick={() => (customRangeModalOpen = false)}>Cancel</button>
				<button class="toolbar-button active" type="button" onclick={applyCustomRange}>Apply range</button>
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
		onkeydown={(event) =>
			event.target === event.currentTarget && ['Enter', ' ', 'Escape'].includes(event.key) && closeActionModal()}
	>
		<div
			class="pause-modal action-capture-modal"
			role="dialog"
			aria-modal="true"
			aria-labelledby="add-action-title-upcoming"
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
						<h2 class="h6 mb-0" id="add-action-title-upcoming">Add to Upcoming</h2>
					</div>
					<p class="soft-text small mb-0 mt-1">
						Defaults to the selected day. Natural-language dates are detected automatically.
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
					placeholder={`Book dentist for Friday\nSaturday grocery restock\nPlan train tickets next week`}
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

<style>
	.upcoming-redesign {
		height: 100%;
		display: flex;
		flex-direction: column;
		background: transparent;
		backdrop-filter: none;
		border: none;
		border-radius: 1.2rem;
		overflow: hidden;
	}

	.upcoming-header {
		padding: 1.1rem 1.2rem 1rem;
		border-bottom: 1px solid rgba(133, 188, 255, 0.16);
		background: rgba(255, 255, 255, 0.02);
		display: grid;
		gap: 0.95rem;
	}

	.upcoming-top-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.upcoming-title-block {
		min-width: 0;
	}

	.upcoming-title {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.upcoming-title i {
		font-size: 1rem;
		color: rgba(117, 212, 255, 0.95);
		padding: 0.4rem;
		border-radius: 0.6rem;
		background: rgba(66, 130, 255, 0.14);
	}

	.upcoming-title h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 650;
		color: var(--text);
	}

	.upcoming-subtitle {
		margin-top: 0.25rem;
		color: var(--muted);
		font-size: 0.82rem;
	}

	.upcoming-header-right {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.close-btn {
		width: 2.2rem;
		height: 2.2rem;
		border: 1px solid rgba(255, 255, 255, 0.14);
		background: rgba(255, 255, 255, 0.06);
		border-radius: 0.65rem;
		color: var(--muted);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.close-btn:hover {
		background: rgba(255, 107, 129, 0.2);
		color: #ff6b81;
		border-color: rgba(255, 107, 129, 0.45);
	}

	.range-chip-row {
		display: flex;
		gap: 0.42rem;
		flex-wrap: wrap;
	}

	.range-chip {
		padding: 0.36rem 0.66rem;
		border: 1px solid rgba(137, 186, 255, 0.24);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.07);
		color: var(--text);
		font-size: 0.77rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.range-chip:hover {
		background: rgba(255, 255, 255, 0.12);
		border-color: rgba(117, 212, 255, 0.5);
	}

	.range-chip.active {
		background: linear-gradient(145deg, rgba(66, 170, 255, 0.5), rgba(66, 108, 224, 0.45));
		border-color: rgba(117, 212, 255, 0.45);
		color: #ebf6ff;
	}

	.quick-chip-row {
		display: flex;
		gap: 0.4rem;
		overflow-x: auto;
		scrollbar-width: none;
		padding-bottom: 0.08rem;
	}

	.quick-chip-row::-webkit-scrollbar {
		display: none;
	}

	.quick-chip {
		flex-shrink: 0;
		padding: 0.36rem 0.62rem;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(137, 186, 255, 0.2);
		border-radius: 999px;
		color: var(--muted);
		font-size: 0.76rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.quick-chip:hover {
		background: rgba(255, 255, 255, 0.12);
		color: var(--text);
	}

	.quick-chip.active {
		background: linear-gradient(145deg, rgba(66, 170, 255, 0.5), rgba(66, 108, 224, 0.45));
		color: #ebf6ff;
		border-color: rgba(117, 212, 255, 0.45);
	}

	.filter-summary-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	.filter-summary-copy {
		font-size: 0.78rem;
		color: var(--muted);
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(137, 186, 255, 0.16);
		border-radius: 0.62rem;
		padding: 0.32rem 0.58rem;
	}

	.filter-summary-actions {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		flex-wrap: wrap;
	}

	.upcoming-toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.8rem;
		flex-wrap: wrap;
	}

	.upcoming-search-shell {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		flex: 1 1 16rem;
		max-width: 28rem;
		padding: 0.46rem 0.62rem;
		border-radius: 0.76rem;
		border: 1px solid rgba(137, 186, 255, 0.24);
		background: rgba(255, 255, 255, 0.06);
	}

	.upcoming-search-shell i {
		color: var(--muted);
		font-size: 0.78rem;
	}

	.upcoming-search-shell input {
		width: 100%;
		background: transparent;
		border: 0;
		color: var(--text);
		font-size: 0.84rem;
	}

	.upcoming-search-shell input:focus {
		outline: none;
	}

	.toolbar-actions {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.toolbar-button-lite {
		padding: 0.4rem 0.64rem;
		border: 1px solid rgba(137, 186, 255, 0.24);
		background: rgba(255, 255, 255, 0.07);
		color: var(--text);
		border-radius: 0.66rem;
		font-size: 0.78rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.toolbar-button-lite:hover {
		background: rgba(255, 255, 255, 0.13);
	}

	.stat-card {
		display: flex;
		flex-direction: column;
		padding: 0.42rem 0.8rem;
		background: rgba(45, 127, 249, 0.14);
		border: 1px solid rgba(89, 213, 255, 0.26);
		border-radius: 0.72rem;
	}

	.stat-number {
		font-size: 1.05rem;
		font-weight: 700;
		color: var(--cyan);
		line-height: 1;
	}

	.stat-label {
		font-size: 0.7rem;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.icon-btn {
		width: 2.2rem;
		height: 2.2rem;
		border: 1px solid rgba(137, 186, 255, 0.24);
		border-radius: 0.66rem;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.add-btn {
		background: linear-gradient(145deg, rgba(77, 166, 255, 0.95), rgba(67, 106, 227, 0.95));
		color: white;
	}

	.add-btn:hover {
		filter: brightness(1.06);
		box-shadow: 0 8px 16px rgba(42, 106, 200, 0.3);
	}

	.upcoming-content {
		flex: 1;
		overflow-y: auto;
		padding: 0.95rem 1.2rem 1.2rem;
	}

	.content-section {
		margin-bottom: 0.9rem;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.7rem;
	}

	.section-header h3 {
		margin: 0;
		font-size: 0.98rem;
		font-weight: 600;
		color: var(--text);
	}

	.clear-btn {
		padding: 0.3rem 0.65rem;
		border: 1px solid rgba(255, 107, 129, 0.3);
		background: rgba(255, 107, 129, 0.1);
		color: #ff6b81;
		border-radius: 0.55rem;
		font-size: 0.76rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.clear-btn:hover {
		background: rgba(255, 107, 129, 0.2);
	}

	.day-group {
		margin-bottom: 0.9rem;
		padding: 0.72rem;
		border-radius: 0.95rem;
		background: rgba(255, 255, 255, 0.025);
		border: 1px solid rgba(137, 186, 255, 0.13);
	}

	.day-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.52rem 0.7rem;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(137, 186, 255, 0.18);
		border-radius: 0.7rem;
		margin-bottom: 0.6rem;
	}

	.paused-header {
		background: rgba(255, 184, 77, 0.14);
		border-color: rgba(255, 184, 77, 0.3);
		color: var(--amber);
	}

	.day-name {
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--cyan);
	}

	.day-helper {
		font-size: 0.72rem;
		color: var(--muted);
		padding: 0.14rem 0.38rem;
		border-radius: 999px;
		border: 1px solid rgba(137, 186, 255, 0.16);
		background: rgba(255, 255, 255, 0.06);
	}

	.task-count {
		margin-left: auto;
		font-size: 0.72rem;
		color: var(--muted);
		background: rgba(255, 255, 255, 0.08);
		padding: 0.2rem 0.42rem;
		border-radius: 999px;
	}

	.task-grid {
		display: grid;
		gap: 0.42rem;
	}

	.task-item {
		padding: 0;
		border-radius: 0.7rem;
		transition: all 0.2s ease;
	}

	.task-item:hover {
		background: rgba(255, 255, 255, 0.03);
	}

	.paused-item {
		opacity: 0.82;
		border-left: 2px solid var(--amber);
		padding-left: 0.1rem;
	}

	.empty-state {
		text-align: center;
		padding: 2.2rem 1rem;
		color: var(--muted);
	}

	.empty-state i {
		font-size: 2rem;
		margin-bottom: 0.8rem;
		opacity: 0.5;
	}

	.empty-state p {
		margin: 0 0 0.5rem 0;
		font-size: 0.96rem;
		font-weight: 500;
		color: var(--text);
	}

	.empty-state span {
		font-size: 0.8rem;
		opacity: 0.8;
	}

	.custom-range-modal {
		width: min(30rem, calc(100vw - 1.25rem));
	}

	.custom-range-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.7rem;
	}

	/* Responsive Design */
	@media (max-width: 640px) {
		.upcoming-redesign {
			border-radius: 0.8rem;
		}

		.upcoming-header {
			padding: 0.9rem;
		}

		.upcoming-top-row {
			align-items: flex-start;
		}

		.upcoming-title h2 {
			font-size: 1.1rem;
		}

		.upcoming-subtitle {
			font-size: 0.78rem;
		}

		.range-chip-row {
			overflow-x: auto;
			flex-wrap: nowrap;
			scrollbar-width: none;
		}

		.range-chip-row::-webkit-scrollbar {
			display: none;
		}

		.filter-summary-row {
			align-items: stretch;
		}

		.upcoming-toolbar {
			align-items: stretch;
		}

		.upcoming-search-shell {
			max-width: none;
		}

		.toolbar-actions {
			width: 100%;
			justify-content: space-between;
		}

		.filter-summary-actions {
			width: 100%;
			justify-content: flex-start;
		}

		.custom-range-modal {
			width: min(32rem, calc(100vw - 0.8rem));
		}

		.custom-range-grid {
			grid-template-columns: 1fr;
		}

		.upcoming-content {
			padding: 0.8rem;
		}

		.day-header {
			padding: 0.6rem 0.8rem;
		}

		.empty-state {
			padding: 2rem 1rem;
		}
	}
</style>
