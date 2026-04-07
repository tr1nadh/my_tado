import { browser } from '$app/environment';
import { derived, get, writable } from 'svelte/store';

const storageKey = 'indian-chaos-todo-v2';
const modesStorageKey = 'indian-chaos-modes-v1';
const defaultModes = ['All Modes', 'Work Sprint', 'Home Reset', 'Errands', 'Family Loop', 'Health Check'];
const fallbackTaskMode = 'Work Sprint';

export const priorities = ['High', 'Medium', 'Low'];
export const energyModes = ['Quick', 'Admin', 'Focus'];

export const tasks = writable([]);
export const modes = writable(defaultModes);
export const activeMode = writable('All Modes');
export const hoveredTaskId = writable(null);

let hydrated = false;
let subscribed = false;
let hoverCloseTimer;

function formatDate(date) {
	return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function daysFromToday(offset) {
	const date = new Date();
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

export function initTasks() {
	if (!browser || hydrated) return;

	const saved = localStorage.getItem(storageKey);
	const savedModes = localStorage.getItem(modesStorageKey);

	if (savedModes) {
		try {
			modes.set(normalizeModes(JSON.parse(savedModes)));
		} catch {
			modes.set(defaultModes);
		}
	} else {
		modes.set(defaultModes);
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

	if (!subscribed) {
		subscribed = true;
		tasks.subscribe((list) => {
			if (hydrated) localStorage.setItem(storageKey, JSON.stringify(list));
		});
		modes.subscribe((list) => {
			if (hydrated) localStorage.setItem(modesStorageKey, JSON.stringify(list));
		});
	}
}

export function addTask(task) {
	tasks.update((list) => [
		normalizeTask({ ...task, id: crypto.randomUUID(), createdAt: Date.now(), done: false }),
		...list
	]);
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
	const reassignedMode = getFallbackMode(nextModes);

	modes.set(nextModes);
	tasks.update((list) =>
		list.map((task) => (task.mode === modeToDelete ? normalizeTask({ ...task, mode: reassignedMode }) : task))
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

export function updateTask(id, patch) {
	tasks.update((list) => list.map((task) => (task.id === id ? normalizeTask({ ...task, ...patch }) : task)));
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
