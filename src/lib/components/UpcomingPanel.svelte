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
	export let open = false;
	export let closePanel = () => {};
	export let isMainView = false;

	let selectedDate = '';
	let selectedMonth = '';
	let selectedYear = '';
	let selectedWeek = '';

	function formatDateValue(date) {
		return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
	}

	function createLocalDate(year, month, day) {
		return new Date(year, month, day);
	}

	function getTodayDate() {
		const date = new Date();
		date.setHours(0, 0, 0, 0);
		return date;
	}

	function monthOptions() {
		return Array.from({ length: 12 }, (_, index) => ({
			value: String(index),
			label: new Date(2026, index, 1).toLocaleDateString('en-IN', { month: 'long' })
		}));
	}

	function yearOptions() {
		const currentYear = new Date().getFullYear();
		return Array.from({ length: 4 }, (_, index) => {
			const value = String(currentYear + index);
			return { value, label: value };
		});
	}

	function buildWeekDates(yearValue, monthValue, weekValue) {
		if (yearValue === '' || monthValue === '' || weekValue === '') return [];

		const year = Number(yearValue);
		const month = Number(monthValue);
		const week = Number(weekValue);
		const lastDay = new Date(year, month + 1, 0).getDate();
		const weekRanges = [
			[1, 7],
			[8, 14],
			[15, 21],
			[22, lastDay]
		];
		const [startDay, endDay] = weekRanges[Math.max(0, Math.min(week - 1, weekRanges.length - 1))];

		return Array.from({ length: Math.max(0, endDay - startDay + 1) }, (_, index) => {
			const day = startDay + index;
			const date = createLocalDate(year, month, day);
			const value = formatDateValue(date);
			return {
				value,
				label: date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }),
				helper: ''
			};
		});
	}

	function getWeekForDay(day) {
		if (day <= 7) return '1';
		if (day <= 14) return '2';
		if (day <= 21) return '3';
		return '4';
	}

	function resetUpcomingFilters() {
		const today = getTodayDate();
		selectedMonth = String(today.getMonth());
		selectedYear = String(today.getFullYear());
		selectedWeek = getWeekForDay(today.getDate());
		selectedDate = formatDateValue(today);
	}

	const initialUpcomingDate = getTodayDate();
	const initialUpcomingDateValue = formatDateValue(initialUpcomingDate);
	$: monthChoices = monthOptions();
	$: yearChoices = yearOptions();
	$: selectedMonth = selectedMonth || String(initialUpcomingDate.getMonth());
	$: selectedYear = selectedYear || String(initialUpcomingDate.getFullYear());
	$: selectedWeek = selectedWeek || getWeekForDay(initialUpcomingDate.getDate());
	$: dateOptions = buildWeekDates(selectedYear, selectedMonth, selectedWeek);
	$: selectedDate = dateOptions.some((option) => option.value === selectedDate)
		? selectedDate
		: dateOptions.find((option) => option.value === initialUpcomingDateValue)?.value || dateOptions[0]?.value || '';
	$: showModeBadge = $activeMode === 'All Modes';
	$: scopedTasks = $tasks.filter((task) => modeMatches(task, $activeMode) && dateOptions.some((option) => option.value === task.dueDate));
	$: modalSearchedTasks = scopedTasks.filter((task) => {
		const matchesSearch =
			!search ||
			task.title.toLowerCase().includes(search.toLowerCase());

		return matchesSearch;
	});
	$: openWeekTasks = scopedTasks.filter((task) => !task.done);
	$: pausedActions = scopedTasks.filter((task) => !task.done && task.paused);
	$: completedTasks = scopedTasks.filter((task) => task.done);
	$: groupedUpcomingTasks = dateOptions.map((option) => ({
		...option,
		tasks: openWeekTasks.filter((task) => task.dueDate === option.value && !task.paused)
	}));
	$: visibleUpcomingGroups = groupedUpcomingTasks.filter((group) => group.tasks.length);
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
				return { title, dueDate: selectedDate || match?.dueDate || '' };
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

<div class="upcoming-redesign">
	<div class="upcoming-header">
		<div class="upcoming-title-section">
			<div class="upcoming-title">
				<i class="fa-solid fa-calendar-days"></i>
				<h2>Upcoming</h2>
			</div>
			{#if !isMainView}
				<button class="close-btn" type="button" onclick={closePanel}>
					<i class="fa-solid fa-xmark"></i>
				</button>
			{/if}
		</div>

		<div class="upcoming-date-selector">
			<div class="date-controls">
				<div class="date-control-group">
					<select class="date-select" bind:value={selectedMonth}>
						{#each monthChoices as option}
							<option value={option.value}>{option.label.slice(0, 3)}</option>
						{/each}
					</select>
					<select class="date-select year-select" bind:value={selectedYear}>
						{#each yearChoices as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>
				<div class="week-selector">
					<button class="week-btn" onclick={() => selectedWeek = '1'} class:selected={selectedWeek === '1'}>W1</button>
					<button class="week-btn" onclick={() => selectedWeek = '2'} class:selected={selectedWeek === '2'}>W2</button>
					<button class="week-btn" onclick={() => selectedWeek = '3'} class:selected={selectedWeek === '3'}>W3</button>
					<button class="week-btn" onclick={() => selectedWeek = '4'} class:selected={selectedWeek === '4'}>W4</button>
				</div>
			</div>

			<div class="day-pills">
				{#each dateOptions as option}
					<button
						class={`day-pill ${selectedDate === option.value ? 'active' : ''}`}
						onclick={() => (selectedDate = option.value)}
					>
						<span class="day-label">{option.label.split(' ')[0]}</span>
						<span class="day-number">{option.label.split(' ')[1]}</span>
					</button>
				{/each}
			</div>
		</div>

		<div class="upcoming-stats">
			<div class="stat-card">
				<div class="stat-number">{openWeekTasks.length}</div>
				<div class="stat-label">Planned</div>
			</div>
			<div class="action-buttons">
				<button class="icon-btn search-btn" onclick={openSearch}>
					<i class="fa-solid fa-search"></i>
				</button>
				<button class="icon-btn add-btn" onclick={openActionModal}>
					<i class="fa-solid fa-plus"></i>
				</button>
			</div>
		</div>
	</div>

	<div class="upcoming-content">
		{#if showDone}
			<div class="content-section completed-section">
				<div class="section-header">
					<h3>Completed</h3>
					{#if completedTasks.length}
						<button class="clear-btn" onclick={clearDoneForMode}>Clear All</button>
					{/if}
				</div>
				{#if completedTasks.length}
					<div class="task-grid">
						{#each completedTasks as task (task.id)}
							<div class="task-item" animate:flip={{ duration: 180 }}>
								<TaskRow {task} disableOptions={searchOpen} {showModeBadge} />
							</div>
						{/each}
					</div>
				{:else}
					<div class="empty-state">
						<i class="fa-solid fa-check-circle"></i>
						<p>No completed actions yet</p>
					</div>
				{/if}
			</div>
		{:else}
			<div class="content-section upcoming-section">
				{#if visibleUpcomingGroups.length}
					{#each visibleUpcomingGroups as group}
						<div class="day-group">
							<div class="day-header">
								<span class="day-name">{group.label.split(' ')[0]}</span>
								<span class="day-date">{group.label.split(' ')[1]}</span>
								<span class="task-count">{group.tasks.length} tasks</span>
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
						<i class="fa-solid fa-calendar-xmark"></i>
						<p>No upcoming tasks</p>
						<span>Try adjusting the date range or add new tasks</span>
					</div>
				{/if}

				{#if pausedActions.length}
					<div class="day-group paused-group" bind:this={pausedSection}>
						<div class="day-header paused-header">
							<i class="fa-solid fa-pause-circle"></i>
							<span>Paused</span>
							<span class="task-count">{pausedActions.length} tasks</span>
						</div>
						<div class="task-grid">
							{#each pausedActions as task (task.id)}
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

<style>
	.upcoming-redesign {
		height: 100%;
		display: flex;
		flex-direction: column;
		background: rgba(8, 19, 34, 0.95);
		backdrop-filter: blur(12px);
		border: 1px solid var(--line);
		border-radius: 1.4rem;
		overflow: hidden;
	}

	.upcoming-header {
		padding: 1.5rem;
		border-bottom: 1px solid var(--line);
		background: rgba(255, 255, 255, 0.02);
	}

	.upcoming-title-section {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.5rem;
	}

	.upcoming-title {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.upcoming-title i {
		font-size: 1.2rem;
		color: var(--cyan);
	}

	.upcoming-title h2 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text);
	}

	.close-btn {
		width: 2.2rem;
		height: 2.2rem;
		border: none;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 0.6rem;
		color: var(--muted);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.close-btn:hover {
		background: rgba(255, 107, 129, 0.2);
		color: #ff6b81;
	}

	.upcoming-date-selector {
		margin-bottom: 1.5rem;
	}

	.date-controls {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		gap: 1rem;
	}

	.date-control-group {
		display: flex;
		gap: 0.5rem;
	}

	.date-select {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--line);
		border-radius: 0.8rem;
		background: rgba(255, 255, 255, 0.05);
		color: var(--text);
		font-size: 0.9rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.date-select:hover {
		background: rgba(255, 255, 255, 0.1);
		border-color: var(--cyan);
	}

	.year-select {
		min-width: 4rem;
	}

	.week-selector {
		display: flex;
		gap: 0.25rem;
		background: rgba(255, 255, 255, 0.05);
		padding: 0.25rem;
		border-radius: 0.8rem;
	}

	.week-btn {
		padding: 0.4rem 0.6rem;
		border: none;
		background: transparent;
		color: var(--muted);
		font-size: 0.75rem;
		font-weight: 600;
		border-radius: 0.5rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.week-btn:hover {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text);
	}

	.week-btn.selected {
		background: var(--blue);
		color: white;
	}

	.day-pills {
		display: flex;
		gap: 0.5rem;
		overflow-x: auto;
		padding-bottom: 0.5rem;
		scrollbar-width: none;
	}

	.day-pills::-webkit-scrollbar {
		display: none;
	}

	.day-pill {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 3.5rem;
		padding: 0.6rem 0.4rem;
		border: 1px solid var(--line);
		border-radius: 0.8rem;
		background: rgba(255, 255, 255, 0.03);
		color: var(--muted);
		cursor: pointer;
		transition: all 0.2s ease;
		flex-shrink: 0;
	}

	.day-pill:hover {
		background: rgba(255, 255, 255, 0.08);
		border-color: var(--cyan);
		color: var(--text);
	}

	.day-pill.active {
		background: var(--blue);
		border-color: var(--blue);
		color: white;
	}

	.day-label {
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.day-number {
		font-size: 0.9rem;
		font-weight: 700;
		margin-top: 0.1rem;
	}

	.upcoming-stats {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.stat-card {
		display: flex;
		flex-direction: column;
		padding: 0.5rem 1rem;
		background: rgba(45, 127, 249, 0.1);
		border: 1px solid rgba(89, 213, 255, 0.2);
		border-radius: 0.8rem;
	}

	.stat-number {
		font-size: 1.2rem;
		font-weight: 700;
		color: var(--cyan);
	}

	.stat-label {
		font-size: 0.7rem;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.action-buttons {
		display: flex;
		gap: 0.5rem;
	}

	.icon-btn {
		width: 2.2rem;
		height: 2.2rem;
		border: none;
		border-radius: 0.6rem;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.search-btn {
		background: rgba(255, 255, 255, 0.1);
		color: var(--muted);
	}

	.search-btn:hover {
		background: rgba(255, 255, 255, 0.15);
		color: var(--text);
	}

	.add-btn {
		background: var(--blue);
		color: white;
	}

	.add-btn:hover {
		background: var(--blue-strong);
	}

	.upcoming-content {
		flex: 1;
		overflow-y: auto;
		padding: 1.5rem;
	}

	.content-section {
		margin-bottom: 2rem;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.section-header h3 {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--text);
	}

	.clear-btn {
		padding: 0.3rem 0.8rem;
		border: 1px solid rgba(255, 107, 129, 0.3);
		background: rgba(255, 107, 129, 0.1);
		color: #ff6b81;
		border-radius: 0.5rem;
		font-size: 0.8rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.clear-btn:hover {
		background: rgba(255, 107, 129, 0.2);
	}

	.day-group {
		margin-bottom: 1.5rem;
	}

	.day-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.8rem 1rem;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid var(--line);
		border-radius: 0.8rem;
		margin-bottom: 0.8rem;
	}

	.paused-header {
		background: rgba(255, 184, 77, 0.1);
		border-color: rgba(255, 184, 77, 0.2);
		color: var(--amber);
	}

	.day-name {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--cyan);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.day-date {
		font-size: 1rem;
		font-weight: 700;
		color: var(--text);
	}

	.task-count {
		margin-left: auto;
		font-size: 0.75rem;
		color: var(--muted);
		background: rgba(255, 255, 255, 0.05);
		padding: 0.2rem 0.5rem;
		border-radius: 999px;
	}

	.task-grid {
		display: grid;
		gap: 0.5rem;
	}

	.task-item {
		padding: 0;
		border-radius: 0.8rem;
		transition: all 0.2s ease;
	}

	.task-item:hover {
		background: rgba(255, 255, 255, 0.02);
	}

	.paused-item {
		opacity: 0.8;
		border-left: 3px solid var(--amber);
	}

	.empty-state {
		text-align: center;
		padding: 3rem 1rem;
		color: var(--muted);
	}

	.empty-state i {
		font-size: 2.5rem;
		margin-bottom: 1rem;
		opacity: 0.5;
	}

	.empty-state p {
		margin: 0 0 0.5rem 0;
		font-size: 1rem;
		font-weight: 500;
		color: var(--text);
	}

	.empty-state span {
		font-size: 0.85rem;
		opacity: 0.8;
	}

	/* Responsive Design */
	@media (max-width: 640px) {
		.upcoming-redesign {
			border-radius: 0;
			border-left: none;
			border-right: none;
		}

		.upcoming-header {
			padding: 1rem;
		}

		.upcoming-title-section {
			margin-bottom: 1rem;
		}

		.upcoming-title h2 {
			font-size: 1.3rem;
		}

		.date-controls {
			flex-direction: column;
			gap: 0.8rem;
		}

		.date-control-group {
			width: 100%;
			justify-content: center;
		}

		.week-selector {
			justify-content: center;
		}

		.day-pills {
			gap: 0.3rem;
		}

		.day-pill {
			min-width: 3rem;
			padding: 0.5rem 0.3rem;
		}

		.upcoming-content {
			padding: 1rem;
		}

		.day-header {
			padding: 0.6rem 0.8rem;
		}

		.empty-state {
			padding: 2rem 1rem;
		}
	}

	/* Offcanvas styles for legacy support */
	.upcoming-offcanvas-root {
		position: fixed;
		inset: 0;
		z-index: 1040;
		pointer-events: none;
	}

	.upcoming-offcanvas-root.open {
		pointer-events: auto;
	}

	.upcoming-offcanvas-scrim {
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

	.upcoming-offcanvas-root.open .upcoming-offcanvas-scrim {
		opacity: 1;
	}

	.upcoming-offcanvas-rail-slot {
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

	.upcoming-offcanvas-root.open .upcoming-offcanvas-rail-slot {
		pointer-events: auto;
	}
</style>
