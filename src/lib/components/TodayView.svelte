<script>
	import { onMount, onDestroy, tick } from 'svelte';
	import { flip } from 'svelte/animate';
	import { fly } from 'svelte/transition';
	import { browser } from '$app/environment';
	import TaskRow from '$lib/components/TaskRow.svelte';
	import ZenProgress from '$lib/components/ZenProgress.svelte';
	import SubtleHeader from '$lib/components/SubtleHeader.svelte';
	import {
		activeMode,
		addTask,
		clearDoneForMode,
		getLocalDateKey,
		getModeTimeBlocksForDate,
		getActiveModeTimeBlock,
		modeMatches,
		modes,
		modeIcons,
		tasks,
		settings,
		settingsReady,
		updateSettings,
		rescheduleTasksToToday,
		isOverdue,
		isToday,
		modeColorMap,
		todayStarOptions,
		pauseTask,
		resumeTask,
		toggleTask,
		USER_DAY_START_HOUR
	} from '$lib/tasks';
	import { buildHighlightedDateHtml, detectActionDate, getLineIndexAtCursor, isCursorInsideMatch, stripDetectedDateText } from '$lib/dateDetection';

	let search = '';
	let taskViewMode = 'active'; // 'active', 'paused', 'completed'
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
	let focusView = 'overview';
	let focusIndex = 0;
	let progressiveFocusIndex = 0;
	let focusPauseModalOpen = false;
	let focusPauseReasonDraft = '';
	let focusPressing = false;
	let focusHoldProgress = 0;
	let focusHoldTimer;
	let focusHoldAnimationFrame;
	let focusHoldStart = 0;
	let focusHoldConsumed = false;
	let todayRailOpen = false;
	let upcomingRailOpen = false;
	let inboxRailOpen = false;
	let activeIslandTab = 'Today';
	const islandTabs = ['Inbox', 'Today', 'Upcoming'];
	$: if (!islandTabs.includes(activeIslandTab)) {
		activeIslandTab = 'Today';
	}
	let timelineGrid;
	let lastAutoSwitchedBlockId = null;
	let modeBlockInterval;
	let timelineUpdateInterval;

	// Treat the floating time-block rail as an off-canvas drawer (locks background scroll while open).
	$: if (browser) {
		document.body.classList.toggle(
			'karya-offcanvas-open',
			todayRailOpen && !$settings.todayRailPinned
		);
	}

	// Pre-calculate timeline hours once to avoid expensive re-renders
	const hourFormatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: true });
	const todayTimelineHours = Array.from({ length: 24 }, (_, index) => {
		const hourInTimeline = USER_DAY_START_HOUR + index;
		const displayHour = hourInTimeline >= 24 ? hourInTimeline - 24 : hourInTimeline;
		return {
			key: hourInTimeline,
			label: hourFormatter.format(new Date(2024, 0, 1, displayHour, 0, 0, 0))
		};
	});
	let timeBlockResizeState = null;
	let timeBlockDragState = null;
	let selectedModeToAdd = null;
	let selectedBlockId = null;
	let backlogExpanded = false;
	let gapModalStartMinutes = null;
	let todayDate = getLocalDateKey(new Date());
	const timeBlockTimelineStart = USER_DAY_START_HOUR * 60;
	const timeBlockTimelineEnd = (USER_DAY_START_HOUR + 24) * 60;
	const timeBlockFallbackDuration = 60;
	const timeBlockSnapMinutes = 15;
	const minTimeBlockMinutes = 15;

	const todayStarOrder = ['red', 'blue', 'yellow', 'none'];
	const activeModeBlockFly = { y: -20, duration: 300, delay: 100 };

	function formatDayLabel(date) {
		return new Intl.DateTimeFormat(undefined, {
			weekday: 'long',
			month: 'long',
			day: 'numeric'
		}).format(date);
	}

	function timeToMinutes(value) {
		if (typeof value !== 'string') return 0;
		const [hours = '0', minutes = '0'] = value.split(':');
		let mins = Number.parseInt(hours, 10) * 60 + Number.parseInt(minutes, 10);
		if (mins < USER_DAY_START_HOUR * 60) {
			mins += 1440;
		}
		return mins;
	}

	function minutesToTime(value) {
		let mins = value;
		while (mins >= 1440) {
			mins -= 1440;
		}
		const boundedMinutes = Math.max(0, Math.min(mins, 23 * 60 + 59));
		return `${String(Math.floor(boundedMinutes / 60)).padStart(2, '0')}:${String(boundedMinutes % 60).padStart(2, '0')}`;
	}

	function clamp(value, min, max) {
		return Math.max(min, Math.min(value, max));
	}

	function snapMinutes(value) {
		return Math.round(value / timeBlockSnapMinutes) * timeBlockSnapMinutes;
	}

	function formatTimeLabel(value) {
		const [hours = '0', minutes = '0'] = String(value || '').split(':');
		const date = new Date();
		date.setHours(Number.parseInt(hours, 10) || 0, Number.parseInt(minutes, 10) || 0, 0, 0);
		return new Intl.DateTimeFormat('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		}).format(date);
	}

	function normalizeBlockDraft(block) {
		const startMinutes = timeToMinutes(block.startTime || '09:00');
		const endMinutes = timeToMinutes(block.endTime || '10:00');

		return {
			...block,
			startTime: minutesToTime(startMinutes),
			endTime: minutesToTime(endMinutes)
		};
	}

	function getSuggestedNextBlockStart() {
		if (!todayModeBlocks.length) return '09:00';
		const lastBlock = todayModeBlocks[todayModeBlocks.length - 1];
		return lastBlock.endTime;
	}

	function sortByTodayStar(list) {
		return [...list].sort((left, right) => {
			const leftRank = todayStarOrder.indexOf(left.todayStar || 'none');
			const rightRank = todayStarOrder.indexOf(right.todayStar || 'none');
			return leftRank - rightRank;
		});
	}

	function sortForFocusFlow(list) {
		return [...list].sort((left, right) => {
			const leftStarRank = todayStarOrder.indexOf(left.todayStar || 'none');
			const rightStarRank = todayStarOrder.indexOf(right.todayStar || 'none');
			if (leftStarRank !== rightStarRank) return leftStarRank - rightStarRank;

			const leftOverdue = Number(isOverdue(left.dueDate));
			const rightOverdue = Number(isOverdue(right.dueDate));
			if (leftOverdue !== rightOverdue) return rightOverdue - leftOverdue;

			if (left.dueDate !== right.dueDate) return String(left.dueDate || '').localeCompare(String(right.dueDate || ''));
			return 0;
		});
	}

	function enterFocusMode(mode) {
		focusView = mode;
		taskViewMode = 'active';
		focusIndex = 0;
		if (mode === 'progressive') {
			progressiveFocusIndex = 0;
		}
	}

	function exitFocusMode() {
		focusView = 'overview';
		focusPauseModalOpen = false;
	}

	function toggleFocusMode() {
		if (focusView === 'overview') {
			enterFocusMode('progressive');
			return;
		}

		exitFocusMode();
	}

	function stepFocusHold() {
		if (!focusPressing) return;

		focusHoldProgress = Math.min((performance.now() - focusHoldStart) / 520, 1);
		if (focusHoldProgress < 1) {
			focusHoldAnimationFrame = requestAnimationFrame(stepFocusHold);
		}
	}

	function clearFocusHold(clearConsumed = false) {
		if (focusHoldTimer) {
			clearTimeout(focusHoldTimer);
			focusHoldTimer = undefined;
		}
		if (focusHoldAnimationFrame) {
			cancelAnimationFrame(focusHoldAnimationFrame);
			focusHoldAnimationFrame = undefined;
		}

		focusPressing = false;
		focusHoldProgress = 0;
		if (clearConsumed) {
			focusHoldConsumed = false;
		}
	}

	function startFocusHold(event) {
		if (event.button !== undefined && event.button !== 0) return;

		clearFocusHold(true);
		focusPressing = true;
		focusHoldStart = performance.now();
		focusHoldAnimationFrame = requestAnimationFrame(stepFocusHold);
		focusHoldTimer = setTimeout(() => {
			focusHoldConsumed = true;
			clearFocusHold();
			enterFocusMode('single');
		}, 520);
	}

	function cancelFocusHold() {
		clearFocusHold();
	}

	function handleFocusButtonPointerUp(event) {
		if (event.button !== undefined && event.button !== 0) return;

		const shouldToggle = focusPressing && !focusHoldConsumed;
		clearFocusHold();
		if (shouldToggle) {
			toggleFocusMode();
		}
	}

	function handleFocusButtonContextMenu(event) {
		event.preventDefault();
		clearFocusHold(true);
		enterFocusMode('single');
	}

	function handleFocusButtonKeydown(event) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		toggleFocusMode();
	}

	function showNextProgressiveBucket() {
		if (progressiveFocusIndex < nonEmptyProgressiveBuckets.length - 1) {
			progressiveFocusIndex += 1;
		}
	}

	function openTodayRail() {
		if (upcomingRailOpen) {
			upcomingRailOpen = false;
			activeIslandTab = 'Today';
		}
		if (inboxRailOpen) {
			inboxRailOpen = false;
			activeIslandTab = 'Today';
		}
		todayRailOpen = true;
	}

	function closeTodayRail() {
		if ($settings.todayRailPinned) return;
		todayRailOpen = false;
	}

	function toggleTodayRail() {
		if (todayRailOpen) {
			closeTodayRail();
		} else {
			openTodayRail();
		}
	}

	function toggleUpcomingRail() {
		if (upcomingRailOpen) {
			upcomingRailOpen = false;
			activeIslandTab = 'Today';
		} else {
			if (todayRailOpen && !$settings.todayRailPinned) todayRailOpen = false;
			inboxRailOpen = false;
			upcomingRailOpen = true;
			activeIslandTab = 'Upcoming';
		}
	}

	function toggleInboxRail() {
		if (inboxRailOpen) {
			inboxRailOpen = false;
			activeIslandTab = 'Today';
		} else {
			if (todayRailOpen && !$settings.todayRailPinned) todayRailOpen = false;
			upcomingRailOpen = false;
			inboxRailOpen = true;
			activeIslandTab = 'Inbox';
		}
	}

	function persistModeBlocks(nextBlocks) {
		updateSettings({
			modeTimeBlocks: nextBlocks
		});
	}

	function addModeTimeBlock(modeName = null) {
		const nextStartTime = getSuggestedNextBlockStart();
		const startMinutes = timeToMinutes(nextStartTime);
		const nextBlock = normalizeBlockDraft({
			id: crypto.randomUUID(),
			date: todayDate,
			mode: modeName || (timeBlockModeOptions[0] || 'Work Sprint'),
			startTime: nextStartTime,
			endTime: minutesToTime(startMinutes + timeBlockFallbackDuration)
		});

		persistModeBlocks([...$settings.modeTimeBlocks, nextBlock]);
	}

	function updateModeTimeBlock(blockId, patch) {
		persistModeBlocks(
			$settings.modeTimeBlocks.map((block) =>
				block.id === blockId ? normalizeBlockDraft({ ...block, ...patch }) : block
			)
		);
	}

	function removeModeTimeBlock(blockId) {
		persistModeBlocks($settings.modeTimeBlocks.filter((block) => block.id !== blockId));
	}

	function syncActiveModeToBlock() {
		if (!$settingsReady || !$settings.modeTimeBlocksEnabled) {
			lastAutoSwitchedBlockId = null;
			return;
		}

		const activeBlock = getActiveModeTimeBlock($settings, new Date());
		if (!activeBlock) {
			if (lastAutoSwitchedBlockId !== null || $activeMode !== 'All Modes') {
				activeMode.set('All Modes');
				lastAutoSwitchedBlockId = null;
			}
			return;
		}

		if (activeBlock.id !== lastAutoSwitchedBlockId || $activeMode !== activeBlock.mode) {
			activeMode.set(activeBlock.mode);
			lastAutoSwitchedBlockId = activeBlock.id;
		}
	}

	function handleBlockClick(event, blockId) {
		event.stopPropagation();
		if (selectedBlockId === blockId) {
			selectedBlockId = null;
		} else {
			selectedBlockId = blockId;
		}
	}

	function handleGapClick(startMinutes) {
		gapModalStartMinutes = startMinutes;
		selectedBlockId = null;
	}

	function closeGapModal() {
		gapModalStartMinutes = null;
	}

	function submitGapBlock(modeName) {
		if (!gapModalStartMinutes) return;

		const nextBlock = normalizeBlockDraft({
			id: crypto.randomUUID(),
			date: todayDate,
			mode: modeName,
			startTime: minutesToTime(gapModalStartMinutes),
			endTime: minutesToTime(gapModalStartMinutes + 60)
		});

		persistModeBlocks([...$settings.modeTimeBlocks, nextBlock]);
		selectedBlockId = nextBlock.id;
		closeGapModal();
	}

	function stopTimeBlockResize() {
		if (!browser) return;
		window.removeEventListener('pointermove', handleTimeBlockResizeMove);
		window.removeEventListener('pointerup', stopTimeBlockResize);
		window.removeEventListener('pointercancel', stopTimeBlockResize);
		timeBlockResizeState = null;
	}

	function handleTimeBlockResizeMove(event) {
		if (!timeBlockResizeState) return;

		const { blockId, edge, rect, originalStartMinutes, originalEndMinutes } = timeBlockResizeState;
		const relativeY = clamp(event.clientY - rect.top, 0, rect.height);
		const minutesOffset = snapMinutes((relativeY / rect.height) * (timeBlockTimelineEnd - timeBlockTimelineStart));
		const pointerMinutes = clamp(timeBlockTimelineStart + minutesOffset, timeBlockTimelineStart, timeBlockTimelineEnd);

		if (edge === 'start') {
			const nextStartMinutes = clamp(pointerMinutes, timeBlockTimelineStart, originalEndMinutes - minTimeBlockMinutes);
			updateModeTimeBlock(blockId, { startTime: minutesToTime(nextStartMinutes) });
			return;
		}

		const nextEndMinutes = clamp(pointerMinutes, originalStartMinutes + minTimeBlockMinutes, timeBlockTimelineEnd);
		updateModeTimeBlock(blockId, { endTime: minutesToTime(nextEndMinutes) });
	}

	function startTimeBlockResize(event, block, edge) {
		if (!timelineGrid) return;

		event.preventDefault();
		event.stopPropagation();
		openTodayRail();

		timeBlockResizeState = {
			blockId: block.id,
			edge,
			rect: timelineGrid.getBoundingClientRect(),
			originalStartMinutes: timeToMinutes(block.startTime),
			originalEndMinutes: timeToMinutes(block.endTime)
		};

		window.addEventListener('pointermove', handleTimeBlockResizeMove);
		window.addEventListener('pointerup', stopTimeBlockResize);
		window.addEventListener('pointercancel', stopTimeBlockResize);
	}

	function stopTimeBlockDrag() {
		if (!browser) return;
		window.removeEventListener('pointermove', handleTimeBlockDragMove);
		window.removeEventListener('pointerup', stopTimeBlockDrag);
		window.removeEventListener('pointercancel', stopTimeBlockDrag);
		timeBlockDragState = null;
	}

	function handleTimeBlockDragMove(event) {
		if (!timeBlockDragState) return;

		const { blockId, rect, startY, originalStartMinutes, originalEndMinutes } = timeBlockDragState;
		const deltaY = event.clientY - startY;
		
		const minutesOffset = snapMinutes((deltaY / rect.height) * (timeBlockTimelineEnd - timeBlockTimelineStart));
		const duration = originalEndMinutes - originalStartMinutes;
		
		const nextStartMinutes = clamp(originalStartMinutes + minutesOffset, timeBlockTimelineStart, timeBlockTimelineEnd - duration);
		const nextEndMinutes = nextStartMinutes + duration;

		updateModeTimeBlock(blockId, { 
			startTime: minutesToTime(nextStartMinutes),
			endTime: minutesToTime(nextEndMinutes)
		});
	}

	function startTimeBlockDrag(event, block) {
		if (!timelineGrid) return;
		if (event.target.classList.contains('today-time-block-handle')) return;

		event.preventDefault();
		event.stopPropagation();
		openTodayRail();

		timeBlockDragState = {
			blockId: block.id,
			rect: timelineGrid.getBoundingClientRect(),
			startY: event.clientY,
			originalStartMinutes: timeToMinutes(block.startTime),
			originalEndMinutes: timeToMinutes(block.endTime)
		};

		window.addEventListener('pointermove', handleTimeBlockDragMove);
		window.addEventListener('pointerup', stopTimeBlockDrag);
		window.addEventListener('pointercancel', stopTimeBlockDrag);
	}

	$: isGapHidden = $settings.modeTimeBlocksEnabled && !activeModeTimeBlock;
	$: scopedTasks = isGapHidden 
		? [] 
		: $tasks.filter((task) => modeMatches(task, $activeMode) && (isToday(task.dueDate) || isOverdue(task.dueDate)));
	$: allTodayScopedTasks = $tasks.filter((task) => !task.done && (isToday(task.dueDate) || isOverdue(task.dueDate)));
	$: backlogTasks = $tasks.filter((task) => modeMatches(task, $activeMode) && !task.done && !isToday(task.dueDate) && !isOverdue(task.dueDate));
	$: backlogActiveTasks = backlogTasks.filter((task) => !task.paused);
	
	$: searchPoolTasks = [...scopedTasks, ...backlogTasks];
	$: modalSearchedTasks = searchPoolTasks.filter((task) => {
		const matchesSearch =
			!search ||
			task.title.toLowerCase().includes(search.toLowerCase());

		return matchesSearch;
	});
	$: overdueTasks = scopedTasks.filter((task) => !task.done && isOverdue(task.dueDate));
	$: todayTasks = scopedTasks.filter((task) => !task.done && isToday(task.dueDate));
	$: pausedActions = sortByTodayStar(scopedTasks.filter((task) => !task.done && task.paused));
	$: overdueActiveActions = sortByTodayStar(overdueTasks.filter((task) => !task.paused));
	$: todayActiveActions = sortByTodayStar(todayTasks.filter((task) => !task.paused));
	$: activeTodayActions = sortForFocusFlow([...overdueActiveActions, ...todayActiveActions]);
	$: progressiveBuckets = todayStarOrder.map((star) => ({
		star,
		tasks: activeTodayActions.filter((task) => (task.todayStar || 'none') === star)
	}));
	$: nonEmptyProgressiveBuckets = progressiveBuckets.filter((bucket) => bucket.tasks.length);
	$: if (!nonEmptyProgressiveBuckets.length) {
		progressiveFocusIndex = 0;
	} else if (progressiveFocusIndex > nonEmptyProgressiveBuckets.length - 1) {
		progressiveFocusIndex = nonEmptyProgressiveBuckets.length - 1;
	}
	$: currentProgressiveBucket = nonEmptyProgressiveBuckets[progressiveFocusIndex] || null;
	$: nextProgressiveBuckets = currentProgressiveBucket
		? nonEmptyProgressiveBuckets.slice(progressiveFocusIndex + 1)
		: [];
	$: currentProgressiveStarMeta = todayStarOptions.find((option) => option.value === currentProgressiveBucket?.star) || null;
	$: currentProgressiveBucketTitle = currentProgressiveBucket
		? currentProgressiveBucket.star === 'none'
			? 'Remaining actions'
			: `${currentProgressiveBucket.star[0].toUpperCase()}${currentProgressiveBucket.star.slice(1)} star actions`
		: 'Today is clear';
	$: focusActions = activeTodayActions;
	$: if (!focusActions.length) {
		focusIndex = 0;
	} else if (focusIndex > focusActions.length - 1) {
		focusIndex = focusActions.length - 1;
	}
	$: activeFocusTask = focusActions[focusIndex] || null;
	$: focusModeLabel = focusView === 'single' ? 'Single Action' : 'Focus Today';
	$: if (!focusPauseModalOpen) {
		focusPauseReasonDraft = activeFocusTask?.pauseReason || '';
	}
	$: completedTasks = sortByTodayStar(scopedTasks.filter((task) => task.done));
	$: completedTodayTasks = completedTasks.filter((task) => isToday(task.dueDate));
	$: actionCount = actionDraft
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean).length;
	$: showPausedJump = taskViewMode === 'active' && pausedActions.length > 0 && (!pausedSection || !pausedVisible);
	// ZenProgress is completion % for due-now actions (today + overdue), excluding paused.
	$: activeNotPausedCount = overdueActiveActions.length + todayActiveActions.length;
	$: todayDoneCount = completedTodayTasks.length;
	$: todayTotalCount = activeNotPausedCount + todayDoneCount;
	$: todayModeSummaryMap = allTodayScopedTasks.reduce((summary, task) => {
		const current = summary.get(task.mode) || { mode: task.mode, count: 0, overdueCount: 0 };
		current.count += 1;
		if (isOverdue(task.dueDate)) {
			current.overdueCount += 1;
		}
		summary.set(task.mode, current);
		return summary;
	}, new Map());
	$: todayModeSummaries = Array.from(
		todayModeSummaryMap.values()
	).sort((right, left) => right.count - left.count || right.mode.localeCompare(left.mode));
	$: timeBlockModeOptions = $modes.filter((mode) => mode !== 'All Modes');
	$: if ($settings.modeTimeBlocksEnabled && $settingsReady) {
		syncActiveModeToBlock();
	}

	$: taskModeOptions = timeBlockModeOptions.filter((mode) => mode !== 'Sleep');
	$: if (!selectedModeToAdd && taskModeOptions.length > 0) {
		selectedModeToAdd = taskModeOptions[0];
	}
	$: todayModeBlocks = getModeTimeBlocksForDate($settings, todayDate);
	$: activeModeTimeBlock = (() => {
		// Depend on currentTimelineMinutes to re-calculate every minute
		// Depend on todayDate to re-calculate at rollover
		currentTimelineMinutes;
		todayDate;
		return getActiveModeTimeBlock($settings, new Date());
	})();
	
	// Use state-based current minutes that update every minute via timer
	let currentTimelineMinutes = (() => {
		const now = new Date();
		let mins = now.getHours() * 60 + now.getMinutes();
		if (now.getHours() < USER_DAY_START_HOUR) {
			mins += 1440;
		}
		return clamp(mins, timeBlockTimelineStart, timeBlockTimelineEnd);
	})();
	$: currentTimelineTop =
		((currentTimelineMinutes - timeBlockTimelineStart) / (timeBlockTimelineEnd - timeBlockTimelineStart)) * 100;
	$: activeModeBlockProgress = (() => {
		if (!activeModeTimeBlock) return 0;
		const startMinutes = timeToMinutes(activeModeTimeBlock.startTime);
		let endMinutes = timeToMinutes(activeModeTimeBlock.endTime);
		if (endMinutes <= startMinutes) endMinutes += 1440;
		const duration = endMinutes - startMinutes;
		if (duration <= 0) return 0;
		return clamp(((currentTimelineMinutes - startMinutes) / duration) * 100, 0, 100);
	})();
	$: timelineBlocks = (() => {
		const blocksWithMinutes = todayModeBlocks.map(block => {
			const start = timeToMinutes(block.startTime);
			let end = timeToMinutes(block.endTime);
			if (end <= start) end += 1440;
			return { ...block, start, end };
		});

		return blocksWithMinutes.map((block, index) => {
			const totalMinutes = timeBlockTimelineEnd - timeBlockTimelineStart;
			const durationMinutes = block.end - block.start;
			const durationHours = (durationMinutes / 60).toFixed(1).replace(/\.0$/, '');
			const top = ((block.start - timeBlockTimelineStart) / totalMinutes) * 100;
			const height = (Math.max(durationMinutes, 15) / totalMinutes) * 100;

			const hasCollision = blocksWithMinutes.some((other, oIndex) => {
				if (index === oIndex) return false;
				return block.start < other.end && block.end > other.start;
			});

			const blockTasks = allTodayScopedTasks.filter((t) => t.mode === block.mode);

			let progress = 0;
			if (activeModeTimeBlock?.id === block.id) {
				progress = clamp(((currentTimelineMinutes - block.start) / durationMinutes) * 100, 0, 100);
			}

			return {
				...block,
				top,
				height,
				durationDisplay: `${durationHours}h`,
				active: activeModeTimeBlock?.id === block.id,
				collision: hasCollision,
				taskCount: blockTasks.length,
				color: modeColorMap[block.mode] || modeColorMap.Default,
				progress
			};
		});
	})();
	$: timelineGaps = (() => {
		const gaps = [];
		const blocksWithMinutes = todayModeBlocks.map(block => {
			const start = timeToMinutes(block.startTime);
			let end = timeToMinutes(block.endTime);
			if (end <= start) end += 1440;
			return { start, end };
		}).sort((a, b) => a.start - b.start);
		
		let lastEnd = timeBlockTimelineStart;
		for (const block of blocksWithMinutes) {
			if (block.start - lastEnd >= 30) {
				gaps.push({ start: lastEnd, end: block.start });
			}
			lastEnd = Math.max(lastEnd, block.end);
		}
		
		if (timeBlockTimelineEnd - lastEnd >= 30) {
			gaps.push({ start: lastEnd, end: timeBlockTimelineEnd });
		}
		
		const totalMinutes = timeBlockTimelineEnd - timeBlockTimelineStart;
		return gaps.map(gap => ({
			...gap,
			top: ((gap.start - timeBlockTimelineStart) / totalMinutes) * 100,
			height: ((gap.end - gap.start) / totalMinutes) * 100
		}));
	})();
	$: gapModalData = gapModalStartMinutes !== null 
		? timelineGaps.find(g => g.start === gapModalStartMinutes) 
		: null;

	// Initial sync handled by the reactive block above
	// $: if (browser && $settingsReady) {
	// 	syncActiveModeToBlock();
	// }
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
					pausedVisible = entry.isIntersecting();
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
		taskViewMode = 'completed';
	}

	function openPendingView() {
		panelDirection = -1;
		taskViewMode = 'active';
	}

	function openPausedView() {
		panelDirection = 1;
		taskViewMode = 'paused';
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
			exitFocusMode();
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
		syncActiveModeToBlock();

		// Seed a default Sleep block for today if none exists yet
		if ($settingsReady) {
			const hasSleepForToday = ($settings.modeTimeBlocks || []).some(
				(b) => b.date === todayDate && b.mode === 'Sleep'
			);
			if (!hasSleepForToday) {
				const sleepBlock = normalizeBlockDraft({
					id: `sleep-default-${todayDate}`,
					date: todayDate,
					mode: 'Sleep',
					startTime: '22:00',
					endTime: '06:00'
				});
				persistModeBlocks([...($settings.modeTimeBlocks || []), sleepBlock]);
			}
		}

		function updateTimelineTime() {
			const now = new Date();
			let mins = now.getHours() * 60 + now.getMinutes();
			if (now.getHours() < USER_DAY_START_HOUR) {
				mins += 1440;
			}
			currentTimelineMinutes = clamp(mins, timeBlockTimelineStart, timeBlockTimelineEnd);
			
			const newDateKey = getLocalDateKey(now);
			if (newDateKey !== todayDate) {
				todayDate = newDateKey;
			}

			// Also sync mode on minute rollover if enabled
			if ($settings.modeTimeBlocksEnabled) {
				syncActiveModeToBlock();
			}
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
				if (todayRailOpen && !$settings.todayRailPinned) {
					event.preventDefault();
					todayRailOpen = false;
					return;
				}
				event.preventDefault();
				if (inboxRailOpen) {
					inboxRailOpen = false;
					activeIslandTab = 'Today';
					return;
				}
				if (upcomingRailOpen) {
					upcomingRailOpen = false;
					activeIslandTab = 'Today';
					return;
				}
				if (focusPauseModalOpen) {
					focusPauseModalOpen = false;
					return;
				}
				if (searchOpen) closeSearch();
				taskViewMode = 'active';
				exitFocusMode();
			}
		}

		function handleMobileSearch() {
			openSearch();
		}

		window.addEventListener('keydown', handleKeydown);
		window.addEventListener('karya:mobile-search', handleMobileSearch);
		updateTimelineTime();
		timelineUpdateInterval = setInterval(updateTimelineTime, 60000);

		return () => {
			window.removeEventListener('keydown', handleKeydown);
			window.removeEventListener('karya:mobile-search', handleMobileSearch);
			if (modeBlockInterval) clearInterval(modeBlockInterval);
			if (timelineUpdateInterval) clearInterval(timelineUpdateInterval);
		};
	});

	onDestroy(() => {
		pausedObserver?.disconnect();
		clearFocusHold(true);
		stopTimeBlockResize();
		stopTimeBlockDrag();
		if (browser) document.body.classList.remove('karya-offcanvas-open');
	});
</script>

<div class="today-view">
	<div class="actions-panel-shell has-dynamic-island">
	<div class="actions-main-column" style="flex-grow: 1;">
		<SubtleHeader 
			activeModeTimeBlock={activeModeTimeBlock} 
			activeModeTimeBlockProgress={activeModeBlockProgress} 
		/>

		<section class="glass-panel rounded-4 p-4 fade-up" style="flex-grow: 1;">
			<div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
			<div class="d-flex align-items-center gap-3">
				<div class="d-flex align-items-baseline gap-2">
					<ZenProgress completed={todayDoneCount} total={todayTotalCount} size={36} />
				</div>
				{#if taskViewMode === 'completed'}
					<button class="toolbar-button" type="button" onclick={clearDoneForMode}>Clear done</button>
				{/if}
			</div>
			<div class="d-flex flex-wrap align-items-center gap-2">
				<button class="icon-button search-launch-button" type="button" aria-label="Search actions" onclick={openSearch}>
					<i class="fa-solid fa-magnifying-glass"></i>
				</button>
				<button
					class={`toolbar-button focus-mode-trigger ${focusView !== 'overview' ? 'active' : ''} ${focusPressing ? 'pressing' : ''}`}
					type="button"
					aria-label={focusView === 'overview' ? 'Enter Focus Today' : `Exit ${focusModeLabel}`}
					title={focusView === 'overview' ? 'Focus mode' : `Exit ${focusModeLabel}`}
					style={`--focus-hold-progress:${focusHoldProgress}; width: 2.4rem; height: 2.4rem; padding: 0; display: inline-flex; align-items: center; justify-content: center;`}
					oncontextmenu={handleFocusButtonContextMenu}
					onkeydown={handleFocusButtonKeydown}
					onpointerdown={startFocusHold}
					onpointerup={handleFocusButtonPointerUp}
					onpointercancel={cancelFocusHold}
					onpointerleave={cancelFocusHold}
				>
					<i class={`${focusView === 'single' ? 'fa-solid fa-bullseye' : 'fa-solid fa-star'}`}></i>
				</button>
				<button
					class={`icon-button ${todayRailOpen ? 'active' : ''}`}
					type="button"
					aria-label={todayRailOpen ? 'Close mode time block' : 'Open mode time block'}
					title={todayRailOpen ? 'Close mode time block' : 'Mode time block'}
					onclick={toggleTodayRail}
					style="width: 2.4rem; height: 2.4rem; padding: 0; display: inline-flex; align-items: center; justify-content: center;"
				>
					<i class="fa-regular fa-calendar-days"></i>
				</button>
				<button class="btn btn-brand" type="button" aria-label="Add Action" onclick={openActionModal} style="width: 2.4rem; height: 2.4rem; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 0.7rem;">
					<i class="fa-solid fa-plus"></i>
				</button>
			</div>
		</div>

		<!-- Tab buttons for task views -->
		<div class="d-flex gap-2 mb-4" style="border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.1)); padding-bottom: 0;">
			<button
				class={`tab-button ${taskViewMode === 'active' ? 'active' : ''}`}
				type="button"
				onclick={() => { taskViewMode = 'active'; panelDirection = -1; }}
				style="padding: 0.75rem 1rem; border: none; background: none; color: inherit; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; white-space: nowrap;"
			>
				Active {#if overdueActiveActions.length + todayActiveActions.length > 0}<span style="opacity: 0.6;">({overdueActiveActions.length + todayActiveActions.length})</span>{/if}
			</button>
			<button
				class={`tab-button ${taskViewMode === 'paused' ? 'active' : ''}`}
				type="button"
				onclick={() => { taskViewMode = 'paused'; panelDirection = 1; }}
				style="padding: 0.75rem 1rem; border: none; background: none; color: inherit; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; white-space: nowrap;"
			>
				Paused {#if pausedActions.length > 0}<span style="opacity: 0.6;">({pausedActions.length})</span>{/if}
			</button>
			<button
				class={`tab-button ${taskViewMode === 'completed' ? 'active' : ''}`}
				type="button"
				onclick={() => { taskViewMode = 'completed'; panelDirection = 1; }}
				style="padding: 0.75rem 1rem; border: none; background: none; color: inherit; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; white-space: nowrap;"
			>
				Completed {#if completedTodayTasks.length > 0}<span style="opacity: 0.6;">({completedTodayTasks.length})</span>{/if}
			</button>
		</div>

		{#if taskViewMode === 'completed'}
			{#if completedTodayTasks.length}
				<section
					class="mb-4"
					in:fly={{ x: panelDirection > 0 ? 72 : -72, duration: 150 }}
					out:fly={{ x: panelDirection > 0 ? 56 : -56, duration: 120 }}
				>
					<div class="list-heading">Completed Actions</div>
						<div class="task-list">
							{#each completedTodayTasks as task (task.id)}
								<div class="task-reorder-item" animate:flip={{ duration: 180 }}>
									<TaskRow
										{task}
										disableOptions={searchOpen}
										showTodayStarBadge
										showTodayStarControls
										showModeBadge
									/>
								</div>
							{/each}
						</div>
				</section>
			{:else}
				<div class="empty-state">No completed actions right now.</div>
			{/if}
		{:else if taskViewMode === 'paused'}
			<!-- Paused tasks view -->
			{#if pausedActions.length}
				<section
					class="mb-4"
					in:fly={{ x: panelDirection > 0 ? 72 : -72, duration: 150 }}
					out:fly={{ x: panelDirection > 0 ? 56 : -56, duration: 120 }}
				>
					<div class="task-list">
						{#each pausedActions as task (task.id)}
							<div class="task-reorder-item" animate:flip={{ duration: 180 }}>
								<TaskRow
									{task}
									disableOptions={searchOpen}
									showTodayStarBadge
									showTodayStarControls
									showModeBadge
									hideDueDate={false}
								/>
							</div>
						{/each}
					</div>
				</section>
			{:else}
				<div class="empty-state">No paused actions right now.</div>
			{/if}
		{:else if focusView === 'progressive'}
			<div class="today-focus-flow">
				<div class="today-focus-flow-head">
					<div>
						<div class="section-label">Focus Today</div>
						{#if currentProgressiveBucket}
							<div class="today-focus-flow-title">Now working: {currentProgressiveBucketTitle}</div>
							<div class="soft-text small mt-2">
								{currentProgressiveStarMeta?.meaning || 'These are the remaining actions for today.'}
							</div>
						{:else}
							<div class="today-focus-flow-title">Today is clear</div>
						{/if}
					</div>
					<div class="soft-text small">One star bucket at a time.</div>
				</div>

				{#if currentProgressiveBucket}
					<div class="task-list">
						{#each currentProgressiveBucket.tasks as task (task.id)}
							<div class="task-reorder-item" animate:flip={{ duration: 180 }}>
								<TaskRow
									{task}
									disableOptions={searchOpen}
									showTodayStarControls
									showModeBadge
									hideDueDate={true}
								/>
							</div>
						{/each}
					</div>

					{#if nextProgressiveBuckets.length}
						<div class="today-focus-next-action">
							<button
								class="toolbar-button active"
								type="button"
								onclick={showNextProgressiveBucket}
							>
								Show {nextProgressiveBuckets[0].star === 'none'
									? 'remaining actions'
									: `${nextProgressiveBuckets[0].star} star actions`} next
								<i class="fa-solid fa-chevron-right ms-2"></i>
							</button>
						</div>
					{/if}
				{:else}
					<div class="empty-state">Nothing left in Today. Switch back to overview if you want the full page again.</div>
				{/if}

				{#if pausedActions.length}
					<section class="mt-4" bind:this={pausedSection}>
						<div class="list-heading">Paused Actions</div>
						<div class="task-list">
							{#each pausedActions as task (task.id)}
								<div class="task-reorder-item" animate:flip={{ duration: 180 }}>
									<TaskRow
										{task}
										disableOptions={searchOpen}
										showTodayStarControls
										showModeBadge
										hideDueDate={true}
									/>
								</div>
							{/each}
						</div>
					</section>
				{/if}
			</div>
		{:else if taskViewMode === 'active'}
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
										showTodayStarControls
										showTodayStarBadge
										showModeBadge
										hideDueDate={true}
									/>
								</div>
							{/each}
						</div>
					</section>
				{/if}

				<section>
					<div class="list-heading">Today <span class="ms-2 fw-normal" style="opacity: 0.6;">{new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</span></div>
					<div class="task-list">
						{#if todayActiveActions.length}
							{#each todayActiveActions as task (task.id)}
								<div class="task-reorder-item" animate:flip={{ duration: 180 }}>
									<TaskRow
										{task}
										disableOptions={searchOpen}
										showTodayStarControls
										showTodayStarBadge
										showModeBadge
										hideDueDate={true}
									/>
								</div>
							{/each}
						{:else}
							<div class="empty-state">
								{#if isGapHidden}
									<i class="fa-solid fa-lock mb-2 d-block opacity-25" style="font-size: 1.5rem;"></i>
									Actions are hidden during scheduled gaps.
								{:else}
									No actions for today.
								{/if}
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
										showTodayStarControls
										showTodayStarBadge
										showModeBadge
										hideDueDate={true}
									/>
								</div>
							{/each}
						</div>
					</section>
				{/if}

				{#if backlogTasks && backlogTasks.length > 0}
					<section class="mt-5 mb-5 backlog-section">
						<button 
							class="list-heading backlog-toggle border-0 bg-transparent p-0 d-flex align-items-center gap-2 w-100 text-start" 
							type="button" 
							onclick={() => backlogExpanded = !backlogExpanded}
							style="opacity: 0.6; cursor: pointer; transition: opacity 0.2s;"
							onmouseover={(e) => e.currentTarget.style.opacity='1'}
							onmouseout={(e) => e.currentTarget.style.opacity='0.6'}
							onfocus={(e) => e.currentTarget.style.opacity='1'}
							onblur={(e) => e.currentTarget.style.opacity='0.6'}
						>
							<i class="fa-solid fa-chevron-{backlogExpanded ? 'down' : 'right'}" style="font-size: 0.85em; width: 14px; text-align: center;"></i>
							<span>Backlog & Upcoming</span>
							<span class="badge-soft rounded-pill px-2 py-1 ms-2 font-monospace" style="font-size: 0.65rem; font-weight: 600;">{backlogTasks.length}</span>
						</button>
						
						{#if backlogExpanded}
							<div class="task-list mt-4">
								{#each backlogTasks as task (task.id)}
									<div class="task-reorder-item" animate:flip={{ duration: 180 }}>
										<TaskRow
											{task}
											disableOptions={searchOpen}
											showModeBadge
										/>
									</div>
								{/each}
							</div>
						{/if}
					</section>
				{/if}
			</div>
		{/if}
	</section>
	</div>
	</div>

	<aside class="right-dock" style="margin-top: 3.7rem;">
	</aside>

	{#if todayRailOpen && !$settings.todayRailPinned}
		<div class="today-time-rail-backdrop" aria-hidden="true" onclick={closeTodayRail}></div>
	{/if}

	<div class="today-time-rail-container {$settings.todayRailPinned ? 'pinned' : ''}">
		<aside
			class={`today-time-rail ${todayRailOpen || $settings.todayRailPinned ? 'open' : 'collapsed'} ${$settings.todayRailPinned ? 'pinned' : 'floating'}`}
			aria-label="Today time blocks"
			role="dialog"
			aria-modal={todayRailOpen && !$settings.todayRailPinned}
			aria-hidden={!(todayRailOpen || $settings.todayRailPinned)}
			tabindex="-1"
		>
			<div class="today-time-rail-content">
				<div class="today-time-rail-head align-items-center pb-2 mb-3 border-bottom border-light border-opacity-10">
					<div>
						<div class="section-label mb-0 text-white">Time block</div>
						<div class="today-time-rail-date mt-1 text-muted" style="font-size: 0.8rem; font-weight: 500;">{formatDayLabel(new Date())}</div>
					</div>
					<div class="d-flex align-items-center gap-3">
						<label class="form-check form-switch d-flex align-items-center gap-2 mb-0" style="margin: 0; cursor: pointer;" title="Auto-switch mode via schedule">
							<span class="soft-text small" style="font-size: 0.72rem; font-weight: 600; text-transform: uppercase;">Auto</span>
							<input
								class="form-check-input m-0 cursor-pointer"
								type="checkbox"
								style="width: 2rem; height: 1rem;"
								checked={$settings.modeTimeBlocksEnabled}
								onchange={(event) => updateSettings({ modeTimeBlocksEnabled: event.currentTarget.checked })}
							/>
						</label>
						<button
							class="icon-button text-muted"
							style="width: 1.8rem; height: 1.8rem; font-size: 0.95rem;"
							type="button"
							aria-label="Close mode blocks"
							title="Close"
							onclick={closeTodayRail}
						>
							<i class="fa-solid fa-xmark"></i>
						</button>
					</div>
				</div>





			<div class="today-time-calendar-shell">
				<div class="today-time-calendar">
					<div class="today-time-hours">
						{#each todayTimelineHours as hour}
							<div class="today-time-hour">
								<span>{hour.label}</span>
							</div>
						{/each}
					</div>
					<div class="today-time-calendar-grid" bind:this={timelineGrid}>
						{#each todayTimelineHours as hour}
							<div class="today-time-grid-line"></div>
						{/each}

						<div class="today-time-now-line" style={`top:${currentTimelineTop}%;`}>
							<span>Now</span>
						</div>

						{#if gapModalStartMinutes !== null && gapModalData}
							<div 
								class="gap-add-modal-overlay" 
								style={`--gap-top: ${gapModalData.top}%; --gap-height: ${gapModalData.height}%;`}
							>
								<div class="gap-add-modal">
									<button class="gap-add-modal-close" type="button" aria-label="Close" onclick={closeGapModal}>
										<i class="fa-solid fa-xmark"></i>
									</button>
									<div class="gap-add-modal-title">Block Time</div>
									<div class="small soft-text mb-3">
										Starts at {formatTimeLabel(minutesToTime(gapModalStartMinutes))}
									</div>
									
									<div class="gap-add-modal-grid">
										{#each timeBlockModeOptions as mode (mode)}
											<button 
												class="gap-mode-chip" 
												type="button"
												style={`--chip-color: ${modeColorMap[mode] || modeColorMap.Default};`}
												onclick={() => submitGapBlock(mode)}
											>
												<span class="gap-mode-chip-dot"></span>
												{mode}
											</button>
										{/each}
									</div>
								</div>
							</div>
						{/if}

						{#if timelineGaps.length}
							{#each timelineGaps as gap}
								<div 
									class="today-time-gap" 
									style={`top: ${gap.top}%; height: ${gap.height}%;`}
									onclick={() => handleGapClick(gap.start)}
									role="button"
									tabindex="0"
									onkeydown={(e) => e.key === 'Enter' && handleGapClick(gap.start)}
								>
									<i class="fa-solid fa-plus"></i>
									Fill Gap
								</div>
							{/each}
						{/if}

						{#if timelineBlocks.length}
							{#each timelineBlocks as block (block.id)}
								<div
									class={`today-time-block ${block.active ? 'active' : ''} ${selectedBlockId === block.id ? 'selected' : ''} ${block.collision ? 'collision' : ''} ${timeBlockDragState?.blockId === block.id ? 'dragging' : ''}`}
									style={`top:${block.top}%; height:${block.height}%; cursor: ${timeBlockDragState?.blockId === block.id ? 'grabbing' : 'grab'}; --block-color: ${block.color};`}
									onpointerdown={(event) => startTimeBlockDrag(event, block)}
									onclick={(event) => handleBlockClick(event, block.id)}
									role="button"
									tabindex="0"
									onkeydown={(e) => e.key === 'Enter' && handleBlockClick(e, block.id)}
								>
									{#if selectedBlockId === block.id}
										<button
											class="today-time-block-delete"
											type="button"
											title="Delete block"
											onclick={(e) => { e.stopPropagation(); removeModeTimeBlock(block.id); }}
										>
											<i class="fa-solid fa-trash-can"></i>
										</button>
									{/if}

										<button
											class="today-time-block-handle top"
											type="button"
											aria-label={`Resize ${block.mode} block start`}
											onpointerdown={(event) => startTimeBlockResize(event, block, 'start')}
										></button>

										<div class="today-time-block-mode">
											{block.mode} 
											<span class="ms-1 opacity-50 pe-none" style="font-size: 0.75em;">({block.durationDisplay})</span>
										</div>

										<div class="today-time-block-range">
											{formatTimeLabel(block.startTime)} to {formatTimeLabel(block.endTime)}
										</div>


										{#if block.active}
											<div class="today-time-block-progress" style={`width: ${block.progress}%;`}></div>
										{/if}

										<button
											class="today-time-block-handle bottom"
											type="button"
											aria-label={`Resize ${block.mode} block end`}
											onpointerdown={(event) => startTimeBlockResize(event, block, 'end')}
										></button>
									</div>
								{/each}
							{:else}
								<div class="today-time-empty">
									<i class="fa-regular fa-clock"></i>
									<span>Block time for a mode to make Today switch automatically.</span>
								</div>
							{/if}
						</div>
					</div>
				</div>
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
			aria-labelledby="add-action-title-today"
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
						<h2 class="h6 mb-0" id="add-action-title-today">Add to Today</h2>
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
			aria-labelledby="search-actions-title-today"
			tabindex="0"
			onclick={(event) => event.stopPropagation()}
			onkeydown={(event) => event.key === 'Escape' && closeSearch()}
		>
			<div class="d-flex justify-content-between align-items-start gap-3 mb-3">
				<div>
					<div class="section-label">Search</div>
					<h2 class="h6 mt-2 mb-1" id="search-actions-title-today">Search Today</h2>
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
					{#if modalSearchedTasks.length}
						<div class="search-results-list task-list">
							{#each modalSearchedTasks as task (task.id)}
								<div class="search-result-row">
									<TaskRow {task} showModeBadge />
								</div>
							{/each}
						</div>
					{:else}
						<div class="empty-state">No actions match this search.</div>
					{/if}
				{:else}
					<div class="empty-state">Start typing to search Today.</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

{#if focusPauseModalOpen}
	<div
		class="pause-modal-backdrop"
		role="button"
		tabindex="0"
		aria-label="Close focus pause modal"
		onclick={() => focusPauseModalOpen = false}
		onkeydown={(event) =>
			event.target === event.currentTarget && ['Enter', ' ', 'Escape'].includes(event.key) && (focusPauseModalOpen = false)}
	>
		<div
			class="pause-modal"
			role="dialog"
			aria-modal="true"
			aria-labelledby="focus-pause-title"
			tabindex="0"
			onclick={(event) => event.stopPropagation()}
			onkeydown={(event) => event.key === 'Escape' && (focusPauseModalOpen = false)}
		>
			<div class="d-flex justify-content-between align-items-start gap-3 mb-3">
				<div>
					<div class="section-label">Pause Reason</div>
					<h2 class="h6 mt-2 mb-1" id="focus-pause-title">Why pause this action?</h2>
					<p class="soft-text small mb-0">Optional note to help you remember why you paused.</p>
				</div>
				<button class="icon-button" type="button" aria-label="Close focus pause modal" onclick={() => focusPauseModalOpen = false}>
					<i class="fa-solid fa-xmark"></i>
				</button>
			</div>

			<textarea
				class="form-control"
				bind:value={focusPauseReasonDraft}
				rows="3"
				placeholder="e.g., Waiting for response, Need more info, etc."
			></textarea>

			<div class="d-flex justify-content-end gap-2 mt-3">
				<button class="toolbar-button" type="button" onclick={() => focusPauseModalOpen = false}>Cancel</button>
				<button class="toolbar-button active" type="button" onclick={saveFocusPauseReason}>Save</button>
			</div>
		</div>
	</div>
{/if}

<style>
	:global(.tab-button) {
		opacity: 0.6;
		transition: all 0.2s ease;
	}

	:global(.tab-button:hover) {
		opacity: 1;
	}

	:global(.tab-button.active) {
		opacity: 1;
		border-bottom-color: var(--blue) !important;
	}

	:global(.right-dock) {
		position: fixed;
		right: 1rem;
		top: 50%;
		transform: translateY(-50%);
		display: flex;
		flex-direction: column;
		gap: 0;
	}
</style>
