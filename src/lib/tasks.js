import { browser } from '$app/environment';
import { derived, get, writable } from 'svelte/store';

const storageKey = 'indian-chaos-todo-v2';
const modesStorageKey = 'indian-chaos-modes-v1';
const settingsStorageKey = 'indian-chaos-settings-v1';
const defaultModes = ['All Modes', 'Sleep', 'Work Sprint', 'Home Reset', 'Errands', 'Family Loop', 'Health Check'];
const fallbackTaskMode = 'Work Sprint';
const defaultTodayStar = 'none';
const defaultTodayStarLimit = 5;
const defaultModeBlockStartTime = '09:00';
const defaultModeBlockEndTime = '10:00';
export const modeColorMap = {
	Sleep: 'var(--muted)',
	'Work Sprint': 'var(--blue)',
	'Home Reset': 'var(--green)',
	Errands: 'var(--amber)',
	'Family Loop': 'var(--red)',
	'Health Check': 'var(--cyan)',
	Default: 'var(--blue)'
};
const defaultSettings = {
	useUnifiedTodayStarLimit: true,
	todayStarLimit: defaultTodayStarLimit,
	todayStarLimits: {
		red: defaultTodayStarLimit,
		blue: defaultTodayStarLimit,
		yellow: defaultTodayStarLimit
	},
	modeTimeBlocksEnabled: true,
	modeTimeBlocks: []
};

export const USER_DAY_START_HOUR = 6;

export const priorities = ['High', 'Medium', 'Low'];
export const energyModes = ['Quick', 'Admin', 'Focus'];
export const todayStarOptions = [
	{ value: 'red', label: 'Red star', meaning: 'Urgent and important' },
	{ value: 'blue', label: 'Blue star', meaning: 'Urgent but not important' },
	{ value: 'yellow', label: 'Yellow star', meaning: 'Important but not urgent' },
	{ value: 'none', label: 'Remaining', meaning: 'No star assigned yet' }
];

function normalizeStarLimit(value, fallback = defaultTodayStarLimit) {
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) && parsed >= 1 ? parsed : fallback;
}

function normalizeTimeString(value, fallback) {
	if (typeof value !== 'string') return fallback;
	const match = value.match(/^(\d{1,2}):(\d{2})$/);
	if (!match) return fallback;

	const hours = Number.parseInt(match[1], 10);
	const minutes = Number.parseInt(match[2], 10);

	if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return fallback;

	return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function timeToMinutes(value, fallback = 0) {
	const normalized = normalizeTimeString(value, null);
	if (!normalized) return fallback;

	const [hours, minutes] = normalized.split(':').map((part) => Number.parseInt(part, 10));
	return hours * 60 + minutes;
}

function normalizeTodayStar(value, legacyMatrixType = '') {
	if (value === 'red' || value === 'blue' || value === 'yellow' || value === 'none') return value;

	switch (legacyMatrixType) {
		case 'Urgent and Important':
			return 'red';
		case 'Urgent and not important':
			return 'blue';
		case 'Important and not urgent':
			return 'yellow';
		default:
			return defaultTodayStar;
	}
}

function nextTodayStar(value) {
	if (value === 'red') return 'blue';
	if (value === 'blue') return 'yellow';
	return 'none';
}

function normalizeModeTimeBlock(block, fallbackDate = formatDate(new Date())) {
	const startTime = normalizeTimeString(block?.startTime, defaultModeBlockStartTime);
	const startMinutes = timeToMinutes(startTime, 9 * 60);
	const rawEndTime = normalizeTimeString(block?.endTime, defaultModeBlockEndTime);
	const rawEndMinutes = timeToMinutes(rawEndTime, startMinutes + 60);
	// Allow endMinutes to be less than startMinutes (representing next day)
	const endMinutes = rawEndMinutes;
	const normalizedMode = String(block?.mode || '').trim();

	return {
		id: block?.id || crypto.randomUUID(),
		date: /^\d{4}-\d{2}-\d{2}$/.test(String(block?.date || '')) ? String(block.date) : fallbackDate,
		mode: normalizedMode && normalizedMode !== 'All Modes' ? normalizedMode : fallbackTaskMode,
		startTime,
		endTime: `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`
	};
}

function normalizeModeTimeBlocks(list) {
	return (Array.isArray(list) ? list : [])
		.map((block) => normalizeModeTimeBlock(block))
		.sort((left, right) => {
			let leftMinutes = timeToMinutes(left.startTime);
			let rightMinutes = timeToMinutes(right.startTime);

			if (leftMinutes < USER_DAY_START_HOUR * 60) leftMinutes += 1440;
			if (rightMinutes < USER_DAY_START_HOUR * 60) rightMinutes += 1440;

			return leftMinutes - rightMinutes;
		});
}

export function getTodayStarLimits(value) {
	const normalized = normalizeSettings(value);
	if (normalized.useUnifiedTodayStarLimit) {
		return {
			red: normalized.todayStarLimit,
			blue: normalized.todayStarLimit,
			yellow: normalized.todayStarLimit
		};
	}

	return normalized.todayStarLimits;
}

export function getModeTimeBlocksForDate(settingsValue, date = new Date()) {
	const normalized = normalizeSettings(settingsValue);
	const dateKey = typeof date === 'string' ? date : formatDate(date);

	return normalized.modeTimeBlocks.filter((block) => block.date === dateKey);
}

export function getActiveModeTimeBlock(settingsValue, date = new Date()) {
	const normalized = normalizeSettings(settingsValue);
	if (!normalized.modeTimeBlocksEnabled) return null;

	const dateKey = getLocalDateKey(date);
	let currentMinutes = date.getHours() * 60 + date.getMinutes();
	if (date.getHours() < USER_DAY_START_HOUR) {
		currentMinutes += 1440;
	}

	return (
		normalized.modeTimeBlocks.find((block) => {
			if (block.date !== dateKey) return false;

			let startMinutes = timeToMinutes(block.startTime);
			let endMinutes = timeToMinutes(block.endTime);

			if (startMinutes < USER_DAY_START_HOUR * 60) {
				startMinutes += 1440;
			}
			if (endMinutes <= startMinutes) {
				endMinutes += 1440;
			}

			return currentMinutes >= startMinutes && currentMinutes < endMinutes;
		}) || null
	);
}

function normalizeSettings(value) {
	return {
		useUnifiedTodayStarLimit:
			value?.useUnifiedTodayStarLimit === undefined
				? defaultSettings.useUnifiedTodayStarLimit
				: Boolean(value.useUnifiedTodayStarLimit),
		todayStarLimit: normalizeStarLimit(value?.todayStarLimit, defaultSettings.todayStarLimit),
		todayStarLimits: {
			red: normalizeStarLimit(value?.todayStarLimits?.red, defaultSettings.todayStarLimits.red),
			blue: normalizeStarLimit(value?.todayStarLimits?.blue, defaultSettings.todayStarLimits.blue),
			yellow: normalizeStarLimit(value?.todayStarLimits?.yellow, defaultSettings.todayStarLimits.yellow)
		},
		modeTimeBlocksEnabled:
			value?.modeTimeBlocksEnabled === undefined
				? defaultSettings.modeTimeBlocksEnabled
				: Boolean(value.modeTimeBlocksEnabled),
		modeTimeBlocks: normalizeModeTimeBlocks(value?.modeTimeBlocks)
	};
}

function loadInitialSettings() {
	if (!browser) return defaultSettings;

	try {
		const savedSettings = localStorage.getItem(settingsStorageKey);
		return savedSettings ? normalizeSettings(JSON.parse(savedSettings)) : defaultSettings;
	} catch {
		return defaultSettings;
	}
}

export const tasks = writable([]);
export const modes = writable(defaultModes);
export const activeMode = writable('All Modes');
export const hoveredTaskId = writable(null);
export const draggedTask = writable({ id: null, targetId: null, placement: 'before' });
export const settings = writable(loadInitialSettings());
export const settingsReady = writable(false);

let hydrated = false;
let subscribed = false;
let hoverCloseTimer;

function formatDate(date) {
	return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function getLocalDateKey(date = new Date()) {
	const shiftedDate = new Date(date);
	if (shiftedDate.getHours() < USER_DAY_START_HOUR) {
		shiftedDate.setDate(shiftedDate.getDate() - 1);
	}
	return formatDate(shiftedDate);
}

function daysFromToday(offset) {
	const date = new Date();
	// Apply rollover logic to "Today" first
	if (date.getHours() < USER_DAY_START_HOUR) {
		date.setDate(date.getDate() - 1);
	}
	date.setHours(0, 0, 0, 0);
	date.setDate(date.getDate() + offset);
	return formatDate(date);
}

function createSeedTasks() {
	return [
		{ id: 'seed-1', title: 'Pay electricity bill before 8 PM', mode: 'Errands', priority: 'High', energy: 'Quick', context: 'Before outage risk', dueDate: daysFromToday(0), done: false, paused: false, pauseReason: '', pausedAt: '', createdAt: Date.now() },
		{ id: 'seed-2', title: 'Send project update before stand-up starts', mode: 'Work Sprint', priority: 'High', energy: 'Focus', context: 'Commute buffer', dueDate: daysFromToday(0), done: false, paused: false, pauseReason: '', pausedAt: '', createdAt: Date.now() - 1 },
		{ id: 'seed-3', title: 'Call plumber and follow up with landlord', mode: 'Home Reset', priority: 'Medium', energy: 'Admin', context: 'Between meetings', dueDate: daysFromToday(1), done: false, paused: false, pauseReason: '', pausedAt: '', createdAt: Date.now() - 2 },
		{ id: 'seed-4', title: 'Reply to family WhatsApp and confirm evening plan', mode: 'Family Loop', priority: 'Low', energy: 'Quick', context: 'Before dinner rush', dueDate: daysFromToday(0), done: false, paused: false, pauseReason: '', pausedAt: '', createdAt: Date.now() - 3 },
		{ id: 'seed-5', title: 'Book doctor follow-up and set medicine reminder', mode: 'Health Check', priority: 'Medium', energy: 'Admin', context: 'Keep reports nearby', dueDate: daysFromToday(2), done: false, paused: false, pauseReason: '', pausedAt: '', createdAt: Date.now() - 4 },
		{ id: 'seed-6', title: 'Recharge FASTag before tomorrow morning drive', mode: 'Errands', priority: 'Medium', energy: 'Quick', context: 'Do before toll gate surprise', dueDate: daysFromToday(1), done: false, paused: false, pauseReason: '', pausedAt: '', createdAt: Date.now() - 5 },
		{ id: 'seed-7', title: 'Finish invoice draft and send for approval', mode: 'Work Sprint', priority: 'High', energy: 'Focus', context: 'Before lunch window closes', dueDate: daysFromToday(-1), done: false, paused: true, pauseReason: 'Waiting for finance to confirm the final amount before sending the invoice.', pausedAt: daysFromToday(0), createdAt: Date.now() - 6 },
		{ id: 'seed-8', title: 'Refill water bottles and check inverter status', mode: 'Home Reset', priority: 'Low', energy: 'Quick', context: 'Before evening power cut', dueDate: daysFromToday(0), done: false, paused: false, pauseReason: '', pausedAt: '', createdAt: Date.now() - 7 },
		{ id: 'seed-9', title: 'Confirm train timing with cousin and share pickup plan', mode: 'Family Loop', priority: 'Medium', energy: 'Admin', context: 'Need final ETA', dueDate: daysFromToday(-1), done: false, paused: false, pauseReason: '', pausedAt: '', createdAt: Date.now() - 8 },
		{ id: 'seed-10', title: 'Take vitamins and schedule 20-minute walk', mode: 'Health Check', priority: 'Low', energy: 'Quick', context: 'Post-tea break', dueDate: daysFromToday(0), done: false, paused: false, pauseReason: '', pausedAt: '', createdAt: Date.now() - 9 },
		{ id: 'seed-11', title: 'Submit reimbursement receipts', mode: 'Work Sprint', priority: 'Medium', energy: 'Admin', context: 'Finance portal OTP required', dueDate: daysFromToday(3), done: false, paused: false, pauseReason: '', pausedAt: '', createdAt: Date.now() - 10 },
		{ id: 'seed-12', title: 'Sort laundry and set wash cycle', mode: 'Home Reset', priority: 'Low', energy: 'Quick', context: '', dueDate: '', done: true, paused: false, pauseReason: '', pausedAt: '', createdAt: Date.now() - 11 }
	];
}

function normalizeModes(list) {
	const customModes = (Array.isArray(list) ? list : [])
		.map((mode) => String(mode || '').trim())
		.filter(Boolean)
		.filter((mode) => mode !== 'All Modes');

	return ['All Modes', ...customModes];
}

function getFallbackMode(modeList = get(modes)) {
	return modeList.find((mode) => mode !== 'All Modes') || fallbackTaskMode;
}

function normalizeTask(task) {
	return {
		id: task.id || crypto.randomUUID(),
		title: task.title || '',
		mode: task.mode || 'Work Sprint',
		todayStar: normalizeTodayStar(task.todayStar, task.matrixType),
		priority: task.priority || 'Medium',
		energy: task.energy || 'Quick',
		context: task.context || '',
		dueDate: task.dueDate || '',
		done: Boolean(task.done),
		paused: Boolean(task.paused),
		pauseReason: task.pauseReason || '',
		pausedAt: task.pausedAt || '',
		createdAt: task.createdAt || Date.now()
	};
}

function isTodayScopedTask(task) {
	return Boolean(task.dueDate) && (isToday(task.dueDate) || isOverdue(task.dueDate));
}

function rebalanceTodayStars(list, settingsValue = get(settings)) {
	const limits = getTodayStarLimits(settingsValue);
	const counts = { red: 0, blue: 0, yellow: 0 };

	return list.map((task) => {
		const normalizedTask = normalizeTask(task);

		if (normalizedTask.done || !isTodayScopedTask(normalizedTask) || normalizedTask.todayStar === 'none') {
			return normalizedTask;
		}

		let assignedStar = normalizedTask.todayStar;
		while (assignedStar !== 'none' && counts[assignedStar] >= limits[assignedStar]) {
			assignedStar = nextTodayStar(assignedStar);
		}

		if (assignedStar !== 'none') {
			counts[assignedStar] += 1;
		}

		return assignedStar === normalizedTask.todayStar
			? normalizedTask
			: normalizeTask({ ...normalizedTask, todayStar: assignedStar });
	});
}

export function initTasks() {
	if (!browser || hydrated) return;

	const saved = localStorage.getItem(storageKey);
	const savedModes = localStorage.getItem(modesStorageKey);
	const savedSettings = localStorage.getItem(settingsStorageKey);

	if (savedModes) {
		try {
			modes.set(normalizeModes(JSON.parse(savedModes)));
		} catch {
			modes.set(defaultModes);
		}
	} else {
		modes.set(defaultModes);
	}

	if (savedSettings) {
		try {
			settings.set(normalizeSettings(JSON.parse(savedSettings)));
		} catch {
			settings.set(defaultSettings);
		}
	} else {
		settings.set(defaultSettings);
	}

	if (saved) {
		try {
			tasks.set(JSON.parse(saved).map(normalizeTask));
		} catch {
			tasks.set(createSeedTasks());
		}
	} else {
		tasks.set(createSeedTasks());
	}

	hydrated = true;
	settingsReady.set(true);

	if (!subscribed) {
		subscribed = true;
		tasks.subscribe((list) => {
			if (hydrated) localStorage.setItem(storageKey, JSON.stringify(list));
		});
		modes.subscribe((list) => {
			if (hydrated) localStorage.setItem(modesStorageKey, JSON.stringify(list));
		});
		settings.subscribe((value) => {
			if (hydrated) localStorage.setItem(settingsStorageKey, JSON.stringify(value));
		});
	}
}

export function updateSettings(patch) {
	const nextSettings = normalizeSettings({ ...get(settings), ...patch });
	settings.set(nextSettings);
	tasks.update((list) => rebalanceTodayStars(list, nextSettings));
}

export function addTask(task) {
	tasks.update((list) =>
		rebalanceTodayStars([
			normalizeTask({ ...task, id: crypto.randomUUID(), createdAt: Date.now(), done: false }),
			...list
		])
	);
}

export function createMode(name) {
	const trimmedName = String(name || '').trim();
	if (!trimmedName || trimmedName === 'All Modes') return false;

	const existingModes = get(modes);
	if (existingModes.includes(trimmedName)) return false;

	modes.set([...existingModes, trimmedName]);
	activeMode.set(trimmedName);
	return true;
}

export function renameMode(oldName, nextName) {
	const trimmedName = String(nextName || '').trim();
	if (!oldName || oldName === 'All Modes' || !trimmedName || trimmedName === 'All Modes') return false;

	const existingModes = get(modes);
	if (!existingModes.includes(oldName) || (trimmedName !== oldName && existingModes.includes(trimmedName))) return false;

	modes.set(existingModes.map((mode) => (mode === oldName ? trimmedName : mode)));
	tasks.update((list) => list.map((task) => (task.mode === oldName ? normalizeTask({ ...task, mode: trimmedName }) : task)));

	if (get(activeMode) === oldName) {
		activeMode.set(trimmedName);
	}

	return true;
}

export function deleteMode(modeToDelete) {
	if (!modeToDelete || modeToDelete === 'All Modes') return false;

	const existingModes = get(modes);
	if (!existingModes.includes(modeToDelete)) return false;
	if (existingModes.filter((mode) => mode !== 'All Modes').length <= 1) return false;

	const nextModes = existingModes.filter((mode) => mode !== modeToDelete);

	modes.set(nextModes);
	tasks.update((list) =>
		list.map((task) => (task.mode === modeToDelete ? normalizeTask({ ...task, mode: 'All Modes' }) : task))
	);

	if (get(activeMode) === modeToDelete) {
		activeMode.set('All Modes');
	}

	return true;
}

export function moveModeToIndex(modeToMove, targetIndex) {
	if (!modeToMove || modeToMove === 'All Modes') return false;

	const existingModes = get(modes);
	const currentIndex = existingModes.findIndex((mode) => mode === modeToMove);

	if (currentIndex <= 0) return false;

	const boundedTargetIndex = Math.max(1, Math.min(targetIndex, existingModes.length - 1));
	if (boundedTargetIndex === currentIndex) return false;

	const nextModes = [...existingModes];
	const [removedMode] = nextModes.splice(currentIndex, 1);
	nextModes.splice(boundedTargetIndex, 0, removedMode);
	modes.set(nextModes);
	return true;
}

export function toggleTask(id) {
	tasks.update((list) => list.map((task) => (task.id === id ? { ...task, done: !task.done } : task)));
}

export function removeTask(id) {
	tasks.update((list) => list.filter((task) => task.id !== id));
}

export function moveTaskForward(id) {
	tasks.update((list) => {
		const index = list.findIndex((task) => task.id === id);

		if (index <= 0) return list;

		const nextList = [...list];
		[nextList[index - 1], nextList[index]] = [nextList[index], nextList[index - 1]];
		return nextList;
	});
}

export function reorderTaskToTarget(taskId, targetTaskId, placement = 'before') {
	if (!taskId || !targetTaskId || taskId === targetTaskId) return;

	tasks.update((list) => {
		const fromIndex = list.findIndex((task) => task.id === taskId);
		const targetIndex = list.findIndex((task) => task.id === targetTaskId);

		if (fromIndex === -1 || targetIndex === -1 || fromIndex === targetIndex) {
			return list;
		}

		const nextList = [...list];
		const [movedTask] = nextList.splice(fromIndex, 1);
		const insertBaseIndex = placement === 'after' ? targetIndex + 1 : targetIndex;
		const adjustedTargetIndex = fromIndex < insertBaseIndex ? insertBaseIndex - 1 : insertBaseIndex;
		nextList.splice(adjustedTargetIndex, 0, movedTask);
		return nextList;
	});
}

export function updateTask(id, patch) {
	tasks.update((list) =>
		rebalanceTodayStars(list.map((task) => (task.id === id ? normalizeTask({ ...task, ...patch }) : task)))
	);
}

export function rescheduleTasksToToday(ids) {
	const taskIds = new Set((Array.isArray(ids) ? ids : []).filter(Boolean));
	if (!taskIds.size) return;

	tasks.update((list) =>
		list.map((task) =>
			taskIds.has(task.id)
				? normalizeTask({
						...task,
						dueDate: daysFromToday(0)
					})
				: task
		)
	);
}

export function pauseTask(id, reason = '') {
	tasks.update((list) =>
		list.map((task) =>
			task.id === id
				? normalizeTask({
						...task,
						paused: true,
						pauseReason: reason.trim(),
						pausedAt: daysFromToday(0)
					})
				: task
		)
	);
}

export function resumeTask(id) {
	tasks.update((list) =>
		list.map((task) =>
			task.id === id
				? normalizeTask({
						...task,
						paused: false
					})
				: task
		)
	);
}

export function clearDoneForMode() {
	const mode = get(activeMode);
	tasks.update((list) => list.filter((task) => !(task.done && (mode === 'All Modes' || task.mode === mode))));
}

export function isToday(dateString) {
	return Boolean(dateString) && dateString === daysFromToday(0);
}

export function isTomorrow(dateString) {
	return Boolean(dateString) && dateString === daysFromToday(1);
}

export function isOverdue(dateString) {
	return Boolean(dateString) && dateString < daysFromToday(0);
}

export function modeMatches(task, mode) {
	return mode === 'All Modes' || task.mode === mode;
}

export function openTaskActions(taskId) {
	if (hoverCloseTimer) {
		clearTimeout(hoverCloseTimer);
		hoverCloseTimer = undefined;
	}
	hoveredTaskId.set(taskId);
}

export function startTaskDrag(taskId) {
	draggedTask.set({ id: taskId, targetId: null, placement: 'before' });
}

export function updateTaskDragTarget(targetId, placement = 'before') {
	draggedTask.update((value) => ({
		...value,
		targetId,
		placement
	}));
}

export function endTaskDrag() {
	draggedTask.set({ id: null, targetId: null, placement: 'before' });
}

export function closeTaskActions(taskId = null) {
	if (hoverCloseTimer) {
		clearTimeout(hoverCloseTimer);
		hoverCloseTimer = undefined;
	}

	if (taskId) {
		hoveredTaskId.update((currentId) => (currentId === taskId ? null : currentId));
		return;
	}

	hoveredTaskId.set(null);
}

export function scheduleTaskActionsClose(taskId, delay = 5000) {
	if (hoverCloseTimer) {
		clearTimeout(hoverCloseTimer);
	}

	hoverCloseTimer = setTimeout(() => {
		hoveredTaskId.update((currentId) => (currentId === taskId ? null : currentId));
		hoverCloseTimer = undefined;
	}, delay);
}

export const pendingTasks = derived(tasks, ($tasks) => $tasks.filter((task) => !task.done));
export const doneTasks = derived(tasks, ($tasks) => $tasks.filter((task) => task.done));
