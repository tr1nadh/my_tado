<script>
	import { browser } from '$app/environment';
	import InboxPanel from '$lib/components/InboxPanel.svelte';
	import SubtleHeader from '$lib/components/SubtleHeader.svelte';
	import TaskRow from '$lib/components/TaskRow.svelte';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import UpcomingPanel from '$lib/components/UpcomingPanel.svelte';
	import ZenProgress from '$lib/components/ZenProgress.svelte';
	import {
	  buildHighlightedDateHtml,
	  detectActionDate,
	  getLineIndexAtCursor,
	  isCursorInsideMatch,
	  stripDetectedDateText
	} from '$lib/dateDetection';
	import {
	  activeMode,
	  addTask,
	  clearDoneForMode,
	  getActiveModeTimeBlock,
	  getLocalDateKey,
	  getModeIcon,
	  getModeTimeBlocksForDate,
	  isOverdue,
	  isToday,
	  modeColorMap,
	  modeIcons,
	  modeMatches,
	  modes,
	  pauseTask,
	  rescheduleTasksToToday,
	  resumeTask,
	  settings,
	  settingsReady,
	  tasks,
	  todayStarOptions,
	  toggleTask,
	  updateSettings,
	  USER_DAY_START_HOUR
	} from '$lib/tasks';
	import { onDestroy, onMount, tick } from 'svelte';
	import { flip } from 'svelte/animate';
	import { fly } from 'svelte/transition';

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
	const focusHoldDuration = 520;

	let focusView = 'overview';
	let focusIndex = 0;
	let progressiveFocusIndex = 0;
	let focusPauseModalOpen = false;
	let focusPauseReasonDraft = '';
	let focusPressing = false;
	let focusHoldProgress = 0;
	let focusPressTimer;
	let focusHoldAnimationFrame;
	let focusHoldStart = 0;
	let focusHoldConsumed = false;
	let todayRailOpen = false;
	let activeIslandTab = 'Today';
	let timelineGrid;
	let lastAutoSwitchedBlockId = null;
	let modeBlockInterval;
	let timelineUpdateInterval;

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

		focusHoldProgress = Math.min((performance.now() - focusHoldStart) / focusHoldDuration, 1);
		if (focusHoldProgress < 1) {
			focusHoldAnimationFrame = requestAnimationFrame(stepFocusHold);
		}
	}

	function clearFocusHold(clearConsumed = false) {
		if (focusPressTimer) {
			clearTimeout(focusPressTimer);
			focusPressTimer = undefined;
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
		focusPressTimer = setTimeout(() => {
			focusHoldConsumed = true;
			clearFocusHold();
			enterFocusMode('single');
		}, focusHoldDuration);
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
		activeIslandTab = 'Upcoming';
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	function toggleInboxRail() {
		activeIslandTab = 'All';
		window.scrollTo({ top: 0, behavior: 'smooth' });
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
	$: actionCount = actionDraft
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean).length;
	$: showPausedJump = taskViewMode === 'active' && pausedActions.length > 0 && (!pausedSection || !pausedVisible);
	$: todayTotalCount = scopedTasks.length;
	$: todayDoneCount = completedTasks.length;
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
	).sort((left, right) => right.count - left.count || left.mode.localeCompare(right.mode));
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
		taskViewMode = 'completed';
	}

	function openPendingView() {
		panelDirection = -1;
		taskViewMode = 'active';
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
				event.preventDefault();
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
	});
</script>

<div class="actions-panel-shell has-dynamic-island">
	<div class="actions-main-column" style="display: flex; flex-direction: column; gap: 1.5rem;">
		<SubtleHeader
			activeModeTimeBlock={activeModeTimeBlock}
			activeModeTimeBlockProgress={activeModeBlockProgress}
		/>

		{#if activeIslandTab === 'Today'}
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
				Completed {#if completedTasks.length > 0}<span style="opacity: 0.6;">({completedTasks.length})</span>{/if}
			</button>
		</div>

		{#if taskViewMode === 'completed'}
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

			</div>
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
		{:else if activeIslandTab === 'All'}
			<section class="glass-panel rounded-4 p-4 fade-up" style="flex-grow: 1;">
				<InboxPanel open={true} isMainView={true} />
			</section>
		{:else if activeIslandTab === 'Upcoming'}
			<section class="glass-panel rounded-4 p-0 fade-up overflow-hidden" style="flex-grow: 1;">
				<UpcomingPanel open={true} isMainView={true} />
			</section>
		{/if}
		<aside
			class={`today-time-rail ${todayRailOpen || $settings.todayRailPinned ? 'open' : 'collapsed'} ${$settings.todayRailPinned ? 'pinned' : 'floating'}`}
			aria-label="Today time blocks"
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
								onclick={() => (todayRailOpen = false)}
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


		{#if focusView === 'single'}
			<div class="focus-overlay" role="dialog" aria-modal="true" aria-labelledby="focus-mode-title">
				<div class="focus-overlay-backdrop"></div>
				<div class="focus-overlay-content">
					<div class="focus-overlay-exit">
						<button class="focus-exit-button" type="button" aria-label="Exit focus mode" onclick={exitFocusMode}>
							<i class="fa-solid fa-xmark"></i>
						</button>
						<span class="focus-exit-label">ESC</span>
					</div>

					<div class="focus-overlay-head">
						<div>
							{#if activeFocusTask}
								<div class="focus-mode-badge mode" id="focus-mode-title">
									<i class="fa-solid {getModeIcon(activeFocusTask.mode, $modeIcons)} me-2"></i>
									{activeFocusTask.mode}
								</div>
							{:else}
								<div class="focus-mode-badge mode" id="focus-mode-title">Single Action</div>
							{/if}
						</div>
					</div>

					{#if activeFocusTask}
						<div class="focus-overlay-body">

							<div class="focus-overlay-stage">
								<button class="focus-nav-button" type="button" aria-label="Previous action" onclick={showPrevFocus}>
									<i class="fa-solid fa-chevron-left"></i>
								</button>

								<div class="focus-overlay-center">
									<div class="focus-overlay-task">
										{activeFocusTask.paused && activeFocusTask.pauseReason ? activeFocusTask.pauseReason : activeFocusTask.title}
									</div>
									{#if activeFocusTask.paused && activeFocusTask.pauseReason}
										<div class="paused-reason-task soft-text">{activeFocusTask.title}</div>
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
							<div class="d-flex align-items-center gap-2 mt-2">
								{#if $activeMode !== 'All Modes'}
									<div class="active-mode-badge" style={`background: ${modeColorMap[$activeMode] || modeColorMap.Default}; padding: 0.2rem 0.6rem; font-size: 0.75rem;`}>
										<i class="fa-solid {getModeIcon($activeMode, $modeIcons)}"></i>
										{$activeMode}
									</div>
								{/if}
								<h2 class="h6 mb-0" id="add-action-title-today">Add Actions</h2>
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
							{#if modalSearchedTasks.length}
								<div class="search-results-list task-list">
									{#each modalSearchedTasks as task (task.id)}
										<div class="search-result-row">
											<TaskRow
												{task}
												showTodayStarControls
												showTodayStarBadge
												showModeBadge
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
	</div>
</div>
<!-- Dynamic Island–style nav (bottom center) -->
<nav class="dynamic-island-nav mb-4" aria-label="Primary">
	<button
		type="button p-2"
		class={`island-tab ${activeIslandTab === 'All' ? 'active' : ''}`}
		aria-current={activeIslandTab === 'All' ? 'page' : undefined}
		onclick={toggleInboxRail}
	>
		<i class="fa-solid fa-layer-group island-icon" aria-hidden="true"></i>
		<span class="island-label">All</span>
	</button>

	<button
		type="button"
		class={`island-tab ${activeIslandTab === 'Today' ? 'active' : ''}`}
		aria-current={activeIslandTab === 'Today' ? 'page' : undefined}
		onclick={() => {
			activeIslandTab = 'Today';
			window.scrollTo({ top: 0, behavior: 'smooth' });
		}}
	>
		<i class="fa-solid fa-sun island-icon" aria-hidden="true"></i>
		<span class="island-label">Today</span>
	</button>

	<button
		type="button"
		class={`island-tab ${activeIslandTab === 'Upcoming' ? 'active' : ''}`}
		aria-current={activeIslandTab === 'Upcoming' ? 'page' : undefined}
		onclick={toggleUpcomingRail}
	>
		<i class="fa-solid fa-calendar-days island-icon" aria-hidden="true"></i>
		<span class="island-label">Upcoming</span>
	</button>
</nav>

<ToastContainer />

<style>
	/* Tab button styling */
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

	/* Integrated Subtle Mode Selector Active States */
	:global(.today-subtle-mode-display.active) {
		background: rgba(45, 127, 249, 0.05) !important;
		border-color: var(--mode-color, var(--blue)) !important;
		color: #fff !important;
		padding-left: 1.15rem;
		overflow: hidden;
	}

	:global(.today-subtle-modes-dropdown.locked .mode-pill) {
		opacity: 0.6;
		cursor: not-allowed !important;
		background: rgba(255, 255, 255, 0.01) !important;
	}

	:global(.today-subtle-modes-dropdown.locked .mode-pill:hover) {
		transform: none !important;
		border-color: rgba(129, 181, 255, 0.08) !important;
	}
	
	:global(.today-subtle-mode-icon-shell) {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	
	:global(.today-subtle-mode-pulse) {
		position: absolute;
		top: -2px;
		right: -4px;
		width: 6px;
		height: 6px;
		background: var(--mode-color, var(--blue));
		border-radius: 50%;
		/* Removed neon glow */
		animation: today-mode-pulse 2s infinite;
	}
	
	@keyframes today-mode-pulse {
		0% { transform: scale(1); opacity: 0.8; }
		50% { transform: scale(1.4); opacity: 0.3; }
		100% { transform: scale(1); opacity: 0.8; }
	}
	
	:global(.today-subtle-mode-time) {
		font-size: 0.72rem;
		opacity: 0.45;
		font-weight: 600;
		margin-left: 0.4rem;
		letter-spacing: 0.02em;
	}
	
	:global(.today-subtle-mode-progress) {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 2px;
		background: rgba(255, 255, 255, 0.03);
	}
	
	:global(.today-time-block.active:hover) {
		box-shadow: 0 0 16px rgba(100, 100, 100, 0.15);
	}
	/* Reserve space so scrollable content never sits under the fixed island */
	.actions-panel-shell.has-dynamic-island {
		--island-nav-reserve: 6.25rem;
		padding-bottom: calc(var(--island-nav-reserve) + env(safe-area-inset-bottom, 0px));
	}

	.dynamic-island-nav {
		position: fixed;
		left: 50%;
		bottom: max(1rem, calc(0.65rem + env(safe-area-inset-bottom, 0px)));
		top: auto;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		width: min(32rem, calc(100vw - 1.1rem));
		padding: 0.5rem 0.64rem;
		gap: 0.36rem;
		background:
			linear-gradient(145deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.015)),
			rgba(7, 14, 24, 0.86);
		backdrop-filter: blur(16px) saturate(140%);
		-webkit-backdrop-filter: blur(16px) saturate(140%);
		border-radius: 999px;
		border: 1px solid rgba(133, 188, 255, 0.22);
		box-shadow:
			0 14px 30px rgba(0, 0, 0, 0.33),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
		z-index: 1025;
		overflow: hidden;
		pointer-events: none;
	}

	.island-tab {
		position: relative;
		flex: 1 1 0;
		min-width: 0;
		border: 1px solid transparent;
		background: transparent;
		color: var(--muted);
		padding: 0.66rem 0.88rem;
		border-radius: 0.9rem;
		font-weight: 600;
		font-size: 0.8rem;
		cursor: pointer;
		transition:
			transform 0.2s ease,
			background 0.2s ease,
			border-color 0.2s ease,
			color 0.2s ease,
			box-shadow 0.2s ease;
		display: flex;
		flex-direction: row;
		gap: 0.5rem;
		align-items: center;
		justify-content: center;
		white-space: nowrap;
		pointer-events: auto;
	}

	.island-tab::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0));
		opacity: 0;
		transition: opacity 0.2s ease;
		pointer-events: none;
	}

	.island-icon {
		font-size: 0.74rem;
		opacity: 0.86;
	}

	.island-label {
		line-height: 1;
	}

	/* Desktop island navigation — compact sizing */
	@media (min-width: 1200px) {
		.actions-panel-shell.has-dynamic-island {
			--island-nav-reserve: 5rem;
		}

		.dynamic-island-nav {
			width: min(clamp(24rem, 36vw, 34rem), calc(100vw - 2rem));
			max-width: calc(100vw - 2rem);
			padding: 0.36rem 0.58rem;
			gap: 0.3rem;
			bottom: 0.7rem;
		}

		.island-tab {
			padding: 0.58rem 0.8rem;
			font-size: 0.79rem;
		}
	}

	.island-tab:hover:not(:disabled) {
		color: var(--text);
		background: rgba(74, 143, 255, 0.13);
		border-color: rgba(141, 193, 255, 0.25);
		transform: translateY(-1px);
	}

	.island-tab.active {
		color: var(--text);
		background:
			linear-gradient(145deg, rgba(68, 164, 255, 0.32), rgba(61, 104, 220, 0.22)),
			rgba(40, 86, 176, 0.24);
		border-color: rgba(117, 212, 255, 0.45);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.16),
			0 6px 14px rgba(34, 95, 182, 0.33);
	}

	.island-tab:hover:not(:disabled)::before,
	.island-tab.active::before {
		opacity: 1;
	}

	.island-tab:focus-visible {
		outline: 2px solid rgba(158, 210, 255, 0.9);
		outline-offset: 2px;
	}

	@media (max-width: 460px) {
		.dynamic-island-nav {
			width: calc(100vw - 0.75rem);
			padding: 0.34rem 0.36rem;
			gap: 0.22rem;
		}

		.island-tab {
			padding: 0.52rem 0.42rem;
		}

		.island-icon {
			display: none;
		}

		.island-label {
			font-size: 0.76rem;
		}
	}

</style>
