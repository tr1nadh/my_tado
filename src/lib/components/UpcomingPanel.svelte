<script>
	import { onDestroy, onMount, tick } from 'svelte';
	import { flip } from 'svelte/animate';
	import { fly } from 'svelte/transition';
	import { browser } from '$app/environment';
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
	// Page-level modal props
	export let actionModalOpenProp = false;
	export let actionDraftProp = '';
	export let actionInputProp;
	export let actionDismissedPhrasesProp = [];
	export let openActionModal = () => {};
	export let closeActionModal = () => {};
	export let submitActions = () => {};
	export let handleActionDraftInput = () => {};

	let dateScope = 'next7';
	let customStart = '';
	let customEnd = '';
	let customRangeModalOpen = false;
	let filterSheetOpen = false;
	let isMobile = false;
	let collapsedGroups = new Set();
	let collapsedPaused = false;

	let sheetScope = 'next7';
	let sheetCustomStart = '';
	let sheetCustomEnd = '';

	const dateScopeOptions = [
		{ value: 'overdue', label: 'Overdue' },
		{ value: 'today', label: 'Today' },
		{ value: 'tomorrow', label: 'Tomorrow' },
		{ value: 'thisWeek', label: 'This week' },
		{ value: 'next7', label: 'Next 7 days' },
		{ value: 'thisMonth', label: 'This month' },
		{ value: 'custom', label: 'Custom range' },
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

	function getEndOfWeek(dateValue) {
		const end = new Date(dateValue);
		const day = end.getDay(); // 0 = Sunday
		const diff = (7 - day) % 7;
		end.setDate(end.getDate() + diff);
		end.setHours(0, 0, 0, 0);
		return end;
	}

	function ensureCustomRangeDefaults() {
		const today = getTodayDate();
		if (!customStart) customStart = formatDateValue(today);
		if (!customEnd) customEnd = formatDateValue(addDays(today, 6));
	}

	function applyCustomRange() {
		ensureCustomRangeDefaults();
		const start = parseDateValue(customStart);
		const end = parseDateValue(customEnd);
		if (start && end && start > end) {
			[customStart, customEnd] = [customEnd, customStart];
		}
		customRangeModalOpen = false;
		dateScope = 'custom';
	}

	function resetUpcomingFilters() {
		dateScope = 'next7';
		search = '';
		showDone = false;
		filterSheetOpen = false;
	}

	function getRangeBoundsForScope(scope) {
		const today = getTodayDate();
		const todayKey = formatDateValue(today);

		if (scope === 'thisWeek') {
			const endOfWeek = getEndOfWeek(today);
			return { start: todayKey, end: formatDateValue(endOfWeek) };
		}

		if (scope === 'thisMonth') {
			const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
			const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
			return { start: formatDateValue(monthStart), end: formatDateValue(monthEnd) };
		}

		if (scope === 'custom') {
			// Avoid mutating state just to compute bounds (important for counts/menus).
			const fallbackStart = customStart || todayKey;
			const fallbackEnd = customEnd || formatDateValue(addDays(today, 6));
			return { start: fallbackStart, end: fallbackEnd };
		}

		// next7 default
		return { start: todayKey, end: formatDateValue(addDays(today, 6)) };
	}

	function taskMatchesDateScope(task, scope = dateScope) {
		const dueDate = String(task.dueDate || '').trim();
		const todayKey = getTodayKey();
		const tomorrowKey = formatDateValue(addDays(getTodayDate(), 1));
		const { start, end } = getRangeBoundsForScope(scope);

		if (scope === 'noDate') return !dueDate;
		if (!dueDate) return false;

		if (scope === 'overdue') return dueDate < todayKey;

		if (scope === 'today') return dueDate === todayKey;
		if (scope === 'tomorrow') return dueDate === tomorrowKey;

		// Remaining scopes use range bounds
		if (dueDate < start || dueDate > end) return false;

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

	function getScopeLabel(scope = dateScope) {
		return dateScopeOptions.find((option) => option.value === scope)?.label || 'Next 7 days';
	}

	function formatShortDate(value) {
		const parsed = parseDateValue(value);
		if (!parsed) return '';
		return parsed.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
	}

	function getScopeButtonLabel() {
		if (dateScope !== 'custom') return getScopeLabel(dateScope);
		ensureCustomRangeDefaults();
		return `Custom (${formatShortDate(customStart)} - ${formatShortDate(customEnd)})`;
	}

	function getDefaultUpcomingDueDate() {
		const today = getTodayDate();
		if (dateScope === 'noDate') return '';
		if (dateScope === 'today') return formatDateValue(today);
		if (dateScope === 'tomorrow') return formatDateValue(addDays(today, 1));
		if (dateScope === 'custom') {
			ensureCustomRangeDefaults();
			return customStart;
		}
		return formatDateValue(today);
	}

	$: showModeBadge = $activeMode === 'All Modes';
	$: normalizedSearch = search.trim().toLowerCase();
	$: scopedTasks = $tasks.filter((task) => modeMatches(task, $activeMode) && taskMatchesDateScope(task));
	$: filteredTasks = scopedTasks.filter((task) =>
		!normalizedSearch || task.title.toLowerCase().includes(normalizedSearch)
	);
	$: openCount = filteredTasks.filter((task) => !task.done).length;
	$: doneCount = filteredTasks.filter((task) => task.done).length;
	$: openTasks = filteredTasks.filter((task) => !task.done);
	$: activeOpenTasks = openTasks.filter((task) => !task.paused);
	$: filteredPausedActions = openTasks.filter((task) => task.paused);
	$: filteredCompletedTasks = filteredTasks.filter((task) => task.done);
	$: visibleUpcomingGroups = groupByDueDate(activeOpenTasks);
	$: visibleDoneGroups = groupByDueDate(filteredCompletedTasks);
	$: scopeCounts = dateScopeOptions.reduce((counts, option) => {
		const matchTab = (task) => (showDone ? task.done : !task.done);
		const count = $tasks.filter((task) => modeMatches(task, $activeMode) && matchTab(task) && taskMatchesDateScope(task, option.value)).length;
		counts[option.value] = count;
		return counts;
	}, {});
	$: effectiveActionDraft = isMainView ? actionDraftProp : actionDraft;
	$: effectiveActionDismissedPhrases = isMainView ? actionDismissedPhrasesProp : actionDismissedPhrases;
	$: actionCount = effectiveActionDraft
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean).length;
	$: showPausedJump = !showDone && filteredPausedActions.length > 0 && (!pausedSection || !pausedVisible);
	$: actionLines = effectiveActionDraft.split('\n');
	$: actionHighlightHtml = actionLines
		.map((line, index) => {
			const match = detectActionDate(line);
			return buildHighlightedDateHtml(
				line,
				match && match.phrase.toLowerCase() !== (effectiveActionDismissedPhrases[index] || '') ? match : null
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

	function closeSearch() {
		searchOpen = false;
		search = '';
	}

	function openCompletedView() {
		panelDirection = 1;
		showDone = true;
	}

	function openPendingView() {
		panelDirection = -1;
		showDone = false;
	}

	function toggleGroup(key) {
		const next = new Set(collapsedGroups);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		collapsedGroups = next;
	}

	function togglePausedGroup() {
		collapsedPaused = !collapsedPaused;
	}

	function openFilterSheet() {
		sheetScope = dateScope;
		sheetCustomStart = customStart;
		sheetCustomEnd = customEnd;
		if (sheetScope === 'custom') {
			ensureCustomRangeDefaults();
			sheetCustomStart = customStart;
			sheetCustomEnd = customEnd;
		}
		filterSheetOpen = true;
	}

	function closeFilterSheet() {
		filterSheetOpen = false;
	}

	function applySheetCustomRange() {
		const start = parseDateValue(sheetCustomStart);
		const end = parseDateValue(sheetCustomEnd);
		if (start && end && start > end) {
			[sheetCustomStart, sheetCustomEnd] = [sheetCustomEnd, sheetCustomStart];
		}
		customStart = sheetCustomStart;
		customEnd = sheetCustomEnd;
		dateScope = 'custom';
		filterSheetOpen = false;
	}

	function applySheetFilters() {
		if (sheetScope === 'custom') {
			applySheetCustomRange();
		} else {
			dateScope = sheetScope;
			filterSheetOpen = false;
		}
	}

	function jumpToPaused() {
		pausedSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function portal(node) {
		if (typeof document === 'undefined') {
			return {
				destroy() {}
			};
		}

		document.body.appendChild(node);
		document.body.classList.add('karya-offcanvas-open');

		return {
			destroy() {
				node.remove();
				document.body.classList.remove('karya-offcanvas-open');
			}
		};
	}

	onMount(() => {
		let mql;
		let updateMql;
		if (browser) {
			mql = window.matchMedia('(max-width: 767px)');
			updateMql = () => {
				isMobile = mql.matches;
			};
			updateMql();
			mql.addEventListener('change', updateMql);
		}

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
				if (filterSheetOpen) filterSheetOpen = false;
				if (searchOpen) closeSearch();
			}
		}

		function handleMobileSearch() {
			openSearch();
		}

		window.addEventListener('keydown', handleKeydown);
		window.addEventListener('karya:mobile-search', handleMobileSearch);
		return () => {
			if (mql && updateMql) mql.removeEventListener('change', updateMql);
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
				<div class="upcoming-subtitle">Pick a date scope and focus on what is next.</div>
			</div>
			<div class="upcoming-header-right">
				<div class="stat-card" aria-label="Open actions in this view">
					<div class="stat-number">{openCount}</div>
					<div class="stat-label">Open</div>
				</div>
				{#if !isMainView}
					<button class="close-btn" type="button" aria-label="Close upcoming panel" onclick={closePanel}>
						<i class="fa-solid fa-xmark" aria-hidden="true"></i>
					</button>
				{/if}
			</div>
		</div>

		<div class="upcoming-toolbar">
			<div class="upcoming-segment" role="tablist" aria-label="Upcoming tabs">
				<button
					class={`segment-btn ${showDone ? '' : 'active'}`}
					type="button"
					role="tab"
					aria-selected={!showDone}
					onclick={() => openPendingView()}
				>
					Open <span class="segment-count">{openCount}</span>
				</button>
				<button
					class={`segment-btn ${showDone ? 'active' : ''}`}
					type="button"
					role="tab"
					aria-selected={showDone}
					onclick={() => openCompletedView()}
				>
					Done <span class="segment-count">{doneCount}</span>
				</button>
			</div>
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
				<div class="upcoming-scope-shell">
					<button
						class="toolbar-button-lite upcoming-scope-button"
						type="button"
						aria-haspopup="dialog"
						aria-expanded={filterSheetOpen}
						onclick={openFilterSheet}
					>
						<i class="fa-solid fa-sliders" aria-hidden="true"></i>
						<span class="scope-label">{getScopeButtonLabel()}</span>
					</button>
				</div>

				<button class="toolbar-button-lite" type="button" onclick={resetUpcomingFilters}>Reset</button>
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
					<h3>Done</h3>
					{#if filteredCompletedTasks.length}
						<button class="clear-btn" type="button" onclick={clearDoneForMode}>Clear done</button>
					{/if}
				</div>
				{#if visibleDoneGroups.length}
					{#each visibleDoneGroups as group}
						<div class="day-group">
							<button
								class="day-header"
								type="button"
								aria-expanded={!collapsedGroups.has(`done:${group.key}`)}
								onclick={() => toggleGroup(`done:${group.key}`)}
							>
								<span class="day-name">{group.label}</span>
								{#if group.helper}
									<span class="day-helper">{group.helper}</span>
								{/if}
								<span class="task-count">{group.tasks.length} actions</span>
								<i class={`fa-solid ${collapsedGroups.has(`done:${group.key}`) ? 'fa-chevron-right' : 'fa-chevron-down'} chevron`} aria-hidden="true"></i>
							</button>
							{#if !collapsedGroups.has(`done:${group.key}`)}
								<div class="task-grid">
									{#each group.tasks as task (task.id)}
										<div class="task-item" animate:flip={{ duration: 180 }}>
											<TaskRow {task} disableOptions={searchOpen} {showModeBadge} />
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				{:else}
					<div class="empty-state">
						<i class="fa-solid fa-check-circle" aria-hidden="true"></i>
						<p>No done actions in this view</p>
					</div>
				{/if}
			</div>
		{:else}
			<div class="content-section upcoming-section">
				{#if visibleUpcomingGroups.length}
					{#each visibleUpcomingGroups as group}
						<div class="day-group">
							<button
								class="day-header"
								type="button"
								aria-expanded={!collapsedGroups.has(group.key)}
								onclick={() => toggleGroup(group.key)}
							>
								<span class="day-name">{group.label}</span>
								{#if group.helper}
									<span class="day-helper">{group.helper}</span>
								{/if}
								<span class="task-count">{group.tasks.length} actions</span>
								<i class={`fa-solid ${collapsedGroups.has(group.key) ? 'fa-chevron-right' : 'fa-chevron-down'} chevron`} aria-hidden="true"></i>
							</button>
							{#if !collapsedGroups.has(group.key)}
								<div class="task-grid">
									{#each group.tasks as task (task.id)}
										<div class="task-item" animate:flip={{ duration: 180 }}>
											<TaskRow {task} disableOptions={searchOpen} {showModeBadge} />
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				{:else}
					<div class="empty-state">
						<i class="fa-solid fa-calendar-xmark" aria-hidden="true"></i>
						<p>No open actions here</p>
						<span>Try another date scope, reset, or add a new action.</span>
					</div>
				{/if}

				{#if filteredPausedActions.length}
					<div class="day-group paused-group" bind:this={pausedSection}>
						<button
							class="day-header paused-header"
							type="button"
							aria-expanded={!collapsedPaused}
							onclick={togglePausedGroup}
						>
							<i class="fa-solid fa-pause-circle" aria-hidden="true"></i>
							<span>Paused</span>
							<span class="task-count">{filteredPausedActions.length} actions</span>
							<i class={`fa-solid ${collapsedPaused ? 'fa-chevron-right' : 'fa-chevron-down'} chevron`} aria-hidden="true"></i>
						</button>
						{#if !collapsedPaused}
							<div class="task-grid">
								{#each filteredPausedActions as task (task.id)}
									<div class="task-item paused-item" animate:flip={{ duration: 180 }}>
										<TaskRow {task} disableOptions={searchOpen} {showModeBadge} />
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

{#if filterSheetOpen}
	<div
		use:portal
		class="upcoming-filter-sheet-backdrop"
		role="button"
		tabindex="0"
		aria-label="Close filters"
		onclick={closeFilterSheet}
		onkeydown={(event) =>
			event.target === event.currentTarget && ['Enter', ' ', 'Escape'].includes(event.key) && closeFilterSheet()}
	>
		<div
			class="upcoming-filter-sheet"
			role="dialog"
			aria-modal="true"
			aria-label="Upcoming filters"
			tabindex="0"
			onclick={(event) => event.stopPropagation()}
			onkeydown={(event) => event.key === 'Escape' && closeFilterSheet()}
		>
			<div class="sheet-head">
				<div>
					<div class="section-label">Filters</div>
					<div class="sheet-title">{getScopeLabel(sheetScope)}</div>
				</div>
				<button class="icon-button" type="button" aria-label="Close filters" onclick={closeFilterSheet}>
					<i class="fa-solid fa-xmark"></i>
				</button>
			</div>

			<div class="sheet-content">
				<div class="sheet-section-title">Date scope</div>
				<div class="sheet-options">
					{#each dateScopeOptions as option}
						<button
							type="button"
							class={`sheet-option ${sheetScope === option.value ? 'active' : ''}`}
							onclick={() => {
								if (option.value === 'custom') {
									sheetScope = 'custom';
									ensureCustomRangeDefaults();
									sheetCustomStart = customStart;
									sheetCustomEnd = customEnd;
								} else {
									sheetScope = option.value;
								}
							}}
						>
							<span>{option.label}</span>
							<span class="sheet-count">{scopeCounts[option.value] || 0}</span>
						</button>
					{/each}
				</div>

				{#if sheetScope === 'custom'}
					<div class="sheet-custom-range">
						<div class="sheet-section-title">Custom range</div>
						<div class="custom-range-grid">
							<label class="settings-number-field">
								<span>Start</span>
								<input class="form-control" type="date" bind:value={sheetCustomStart} />
							</label>
							<label class="settings-number-field">
								<span>End</span>
								<input class="form-control" type="date" bind:value={sheetCustomEnd} />
							</label>
						</div>
					</div>
				{/if}
			</div>

			<div class="sheet-footer">
				<button class="toolbar-button-lite" type="button" onclick={resetUpcomingFilters}>Reset</button>
				<button class="toolbar-button active" type="button" onclick={applySheetFilters}>Apply</button>
			</div>
		</div>
	</div>
{/if}

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
					<p class="soft-text small mb-0">This range becomes your active date scope.</p>
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

<style>
	.upcoming-redesign {
		height: 100%;
		min-height: 600px;
		display: flex;
		flex-direction: column;
		background:
			radial-gradient(ellipse at top right, rgba(180, 83, 9, 0.08) 0%, transparent 55%),
			var(--panel);
		backdrop-filter: none;
		border: none;
		border-radius: 1.2rem;
		overflow: visible;
	}

	.upcoming-header {
		padding: 1.1rem 1.2rem 1rem;
		border-bottom: 1px solid rgba(180, 83, 9, 0.2);
		background: rgba(255, 255, 255, 0.01);
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
		color: var(--blue);
		padding: 0.4rem;
		border-radius: 0.6rem;
		background: rgba(180, 83, 9, 0.18);
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
		background: rgba(153, 27, 27, 0.2);
		color: #ef4444;
		border-color: rgba(153, 27, 27, 0.45);
	}

	.range-chip-row {
		display: flex;
		gap: 0.42rem;
		flex-wrap: wrap;
	}

	.range-chip {
		padding: 0.36rem 0.66rem;
		border: 1px solid rgba(180, 83, 9, 0.24);
		border-radius: 999px;
		background: rgba(180, 83, 9, 0.06);
		color: var(--muted);
		font-size: 0.77rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.range-chip:hover {
		background: rgba(180, 83, 9, 0.14);
		border-color: rgba(245, 158, 11, 0.4);
		color: var(--text);
	}

	.range-chip.active {
		background: rgba(180, 83, 9, 0.3);
		border-color: rgba(245, 158, 11, 0.5);
		color: var(--cyan);
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
		background: rgba(180, 83, 9, 0.06);
		border: 1px solid rgba(180, 83, 9, 0.18);
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
		background: rgba(180, 83, 9, 0.3);
		color: var(--cyan);
		border-color: rgba(245, 158, 11, 0.5);
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
		background: rgba(180, 83, 9, 0.08);
		border: 1px solid rgba(180, 83, 9, 0.18);
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

	.upcoming-segment {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.2rem;
		border-radius: 0.8rem;
		border: 1px solid rgba(180, 83, 9, 0.22);
		background: rgba(180, 83, 9, 0.06);
	}

	.segment-btn {
		border: 0;
		background: transparent;
		color: var(--muted);
		padding: 0.42rem 0.68rem;
		border-radius: 0.62rem;
		font-size: 0.78rem;
		font-weight: 700;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		transition: background 160ms ease, color 160ms ease, transform 160ms ease;
	}

	.segment-btn:hover {
		background: rgba(255, 255, 255, 0.06);
	}

	.segment-btn.active {
		background: rgba(180, 83, 9, 0.3);
		color: var(--cyan);
	}

	.segment-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.7rem;
		padding: 0.08rem 0.4rem;
		border-radius: 999px;
		border: 1px solid rgba(180, 83, 9, 0.2);
		background: rgba(180, 83, 9, 0.08);
		font-size: 0.72rem;
		font-weight: 800;
		color: inherit;
	}

	.upcoming-search-shell {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		flex: 1 1 16rem;
		max-width: 28rem;
		padding: 0.46rem 0.62rem;
		border-radius: 0.76rem;
		border: 1px solid rgba(180, 83, 9, 0.2);
		background: rgba(180, 83, 9, 0.05);
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

	.upcoming-scope-shell {
		position: relative;
	}

	.upcoming-scope-button {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
	}

	.scope-label {
		max-width: 14rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.upcoming-scope-menu {
		position: absolute;
		top: calc(100% + 0.45rem);
		right: 0;
		min-width: 16rem;
		padding: 0.45rem;
		border-radius: 0.95rem;
		border: 1px solid var(--line-strong);
		background: var(--panel-solid);
		box-shadow: 0 24px 70px rgba(0, 0, 0, 0.38);
		z-index: 1300;
		display: grid;
		gap: 0.3rem;
	}

	.scope-menu-item {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.52rem 0.65rem;
		border-radius: 0.75rem;
		border: 1px solid transparent;
		background: transparent;
		color: var(--text);
		font-size: 0.82rem;
		font-weight: 650;
		cursor: pointer;
		transition: background 160ms ease, border-color 160ms ease, transform 160ms ease;
	}

	.scope-menu-item:hover {
		background: rgba(245, 158, 11, 0.12);
		border-color: rgba(245, 158, 11, 0.22);
	}

	.scope-menu-item.active {
		background: rgba(245, 158, 11, 0.18);
		border-color: rgba(245, 158, 11, 0.32);
	}

	.scope-menu-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 2rem;
		padding: 0.08rem 0.45rem;
		border-radius: 999px;
		border: 1px solid rgba(252, 211, 77, 0.12);
		background: rgba(255, 255, 255, 0.05);
		color: var(--muted);
		font-size: 0.74rem;
		font-weight: 800;
	}

	.toolbar-button-lite {
		padding: 0.4rem 0.64rem;
		border: 1px solid rgba(180, 83, 9, 0.22);
		background: rgba(180, 83, 9, 0.07);
		color: var(--muted);
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
		background: rgba(245, 158, 11, 0.14);
		border: 1px solid rgba(251, 191, 36, 0.24);
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
		border: 1px solid rgba(180, 83, 9, 0.22);
		border-radius: 0.66rem;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.add-btn {
		background: linear-gradient(145deg, rgba(245, 158, 11, 0.95), rgba(180, 83, 9, 0.95));
		color: white;
	}

	.add-btn:hover {
		filter: brightness(1.06);
		box-shadow: 0 8px 16px rgba(180, 83, 9, 0.3);
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
		border: 1px solid rgba(153, 27, 27, 0.3);
		background: rgba(153, 27, 27, 0.1);
		color: #ef4444;
		border-radius: 0.55rem;
		font-size: 0.76rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.clear-btn:hover {
		background: rgba(153, 27, 27, 0.2);
	}

	.day-group {
		margin-bottom: 0.9rem;
		padding: 0.72rem;
		border-radius: 0.95rem;
		background: rgba(255, 255, 255, 0.025);
		border: 1px solid rgba(252, 211, 77, 0.1);
	}

	.day-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		text-align: left;
		font: inherit;
		cursor: pointer;
		padding: 0.52rem 0.7rem;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(252, 211, 77, 0.16);
		border-radius: 0.7rem;
		margin-bottom: 0.6rem;
	}

	.day-header:hover {
		background: rgba(255, 255, 255, 0.075);
	}

	.day-header:focus-visible {
		outline: 2px solid rgba(245, 158, 11, 0.4);
		outline-offset: 2px;
	}

	.chevron {
		opacity: 0.55;
		font-size: 0.85em;
		margin-left: 0.25rem;
	}

	.paused-header .chevron {
		color: var(--amber);
		opacity: 0.75;
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
		border: 1px solid rgba(252, 211, 77, 0.12);
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

	.upcoming-filter-sheet-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.55);
		z-index: 9999;
		display: flex;
		align-items: stretch;
		justify-content: flex-end;
	}

	.upcoming-filter-sheet {
		width: min(34rem, 100%);
		max-width: 100%;
		height: 100%;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		border-left: 1px solid var(--line-strong);
		background: var(--panel-solid);
		box-shadow: -10px 0 40px rgba(0, 0, 0, 0.4);
		animation: slideIn 0.3s ease-out;
	}

	@keyframes slideIn {
		from {
			transform: translateX(100%);
		}
		to {
			transform: translateX(0);
		}
	}

	.sheet-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 1.25rem 1.25rem 0.5rem;
		flex-shrink: 0;
	}

	.sheet-title {
		color: var(--text);
		font-weight: 700;
		margin-top: 0.2rem;
		font-size: 0.9rem;
	}

	.sheet-section-title {
		margin-top: 0.85rem;
		margin-bottom: 0.45rem;
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.6);
	}

	.sheet-content {
		flex: 1;
		overflow-y: auto;
		padding: 0 1.25rem;
	}

	.sheet-options {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.sheet-option {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.85rem;
		border-radius: 999px;
		border: 1px solid rgba(180, 83, 9, 0.2);
		background: rgba(180, 83, 9, 0.06);
		color: var(--text);
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.sheet-option:hover {
		background: rgba(180, 83, 9, 0.12);
		border-color: rgba(245, 158, 11, 0.3);
	}

	.sheet-option.active {
		border-color: rgba(245, 158, 11, 0.5);
		background: rgba(245, 158, 11, 0.25);
		color: var(--cyan);
	}

	.sheet-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.6rem;
		padding: 0.1rem 0.4rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.08);
		color: var(--muted);
		font-size: 0.72rem;
		font-weight: 700;
	}

	.sheet-custom-range {
		margin-top: 0.5rem;
		padding-top: 0.6rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
	}

	.sheet-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.25rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		background: var(--panel-solid);
		flex-shrink: 0;
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

		.upcoming-segment {
			width: 100%;
			justify-content: space-between;
		}

		.upcoming-search-shell {
			max-width: none;
		}

		.toolbar-actions {
			width: 100%;
			justify-content: flex-end;
			flex-wrap: wrap;
		}

		.scope-label {
			display: none;
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
