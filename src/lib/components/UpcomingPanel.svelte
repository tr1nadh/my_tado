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

<div class="upcoming-main-content">
	<div class="today-time-rail-content" style="padding: 1.5rem; overflow-y: auto;">
			<div class="d-flex align-items-center justify-content-between mb-4">
				<h2 class="h5 mb-0">Upcoming</h2>
				<button class="icon-button" type="button" aria-label="Close" title="Close" onclick={closePanel}>
					<i class="fa-solid fa-xmark"></i>
				</button>
			</div>

		<div class="row g-2 mb-4">
			<div class="col-12 col-md-4">
				<select class="form-select" bind:value={selectedMonth}>
					{#each monthChoices as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</div>
			<div class="col-12 col-md-4">
				<select class="form-select" bind:value={selectedYear}>
					{#each yearChoices as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</div>
			<div class="col-12 col-md-4">
				<select class="form-select" bind:value={selectedWeek}>
					<option value="1">Week 1</option>
					<option value="2">Week 2</option>
					<option value="3">Week 3</option>
					<option value="4">Week 4</option>
				</select>
			</div>
		</div>

		<div class="date-filter-strip mb-4">
			<div class="date-filter-scroller">
				{#each dateOptions as option}
					<button
						class={`date-filter-pill ${selectedDate === option.value ? 'active' : ''}`}
						type="button"
						onclick={() => (selectedDate = option.value)}
					>
						<span class="date-filter-label">{option.label}</span>
					</button>
				{/each}
			</div>
			<button class="toolbar-button flex-shrink-0" type="button" onclick={resetUpcomingFilters}>Reset</button>
		</div>

		<div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
			<div class="d-flex align-items-center gap-3">
				<div class="badge-soft rounded-pill px-3 py-2 font-monospace" style="font-size: 0.72rem; letter-spacing: 0.02em; font-weight: 600; text-transform: uppercase; opacity: 0.9;">
					{openWeekTasks.length} {openWeekTasks.length === 1 ? 'target' : 'targets'} planned
				</div>
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
				<div class="empty-state">No completed actions in this view.</div>
			{/if}
		{:else}
			<div
				in:fly={{ x: panelDirection < 0 ? -72 : 72, duration: 150 }}
				out:fly={{ x: panelDirection < 0 ? -56 : 56, duration: 120 }}
			>
				{#if visibleUpcomingGroups.length}
					{#each visibleUpcomingGroups as group}
						<section class="mb-4">
							<div class="list-heading">{group.label}</div>
							<div class="task-list">
								{#each group.tasks as task (task.id)}
									<div class="task-reorder-item" animate:flip={{ duration: 180 }}>
										<TaskRow {task} disableOptions={searchOpen} {showModeBadge} />
									</div>
								{/each}
							</div>
						</section>
					{/each}
				{:else}
					<div class="empty-state">No actions in this week for this mode.</div>
				{/if}

				{#if pausedActions.length}
					<section class="mt-4" bind:this={pausedSection}>
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
			</div>
		{/if}
	</div>
</div>

<style>
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
