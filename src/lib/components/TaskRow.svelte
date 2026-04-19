<script>
	import { onDestroy, onMount, tick } from 'svelte';
	import {
		buildHighlightedDateHtml,
		detectActionDate,
		formatDetectedDate,
		isCursorInsideMatch,
		stripDetectedDateText
	} from '$lib/dateDetection';
	import {
		activeMode,
		closeTaskActions,
		draggedTask,
		endTaskDrag,
		deleteMode,
		getModeIcon,
		hoveredTaskId,
		modeIcons,
		modes,
		openTaskActions,
		pauseTask,
		removeTask,
		reorderTaskToTarget,
		resumeTask,
		scheduleTaskActionsClose,
		startTaskDrag,
		todayStarOptions,
		toggleTask,
		updateTaskDragTarget,
		updateTask
	} from '$lib/tasks';

	export let task;
	export let showTodayStarControls = false;
	export let disableOptions = false;
	export let showModeBadge = false;

	let editing = false;
	let pauseModalOpen = false;
	let dueDateModalOpen = false;
	let pauseReasonDraft = '';
	let dueDateDraft = '';
	let draftTitle = '';
	let titleInput;
	let actionsOpen = false;
	let editDismissedPhrase = '';
	let skipEditBlurSave = false;
	let dueDateMenuOpen = false;
	let dueDateMenuCloseTimer;
	let dueDateMenuPosition = { top: 0, left: 0 };
	let starMenuOpen = false;
	let starMenuCloseTimer;
	let starMenuPosition = { top: 0, left: 0 };
	let starTriggerHovered = false;
	let modePickerOpen = false;
	let taskLineElement;
	let dueDateButtonElement;
	let starButtonElement;
	let dueDateMenuElement;
	let starMenuElement;
	let rowDragActive = false;
	let pendingDrag = null;
	let suppressEditClick = false;
	let rowDropPlacement = null;

	$: if (!editing) {
		draftTitle = task.title;
	}

	$: if (!pauseModalOpen) {
		pauseReasonDraft = task.pauseReason || '';
	}

	$: if (!dueDateModalOpen) {
		dueDateDraft = task.dueDate || '';
	}

	$: actionsOpen =
		!disableOptions &&
		!starTriggerHovered &&
		!starMenuOpen &&
		!$draggedTask.id &&
		($hoveredTaskId === task.id || editing);
	$: hasPauseReason = Boolean(task.pauseReason?.trim());
	$: rawEditDateMatch = detectActionDate(draftTitle);
	$: editDateMatch =
		rawEditDateMatch && rawEditDateMatch.phrase.toLowerCase() === editDismissedPhrase ? null : rawEditDateMatch;
	$: editDatePreview = buildHighlightedDateHtml(draftTitle, editDateMatch);
	$: selectableModes = $modes.filter((mode) => mode !== 'All Modes');
	$: selectedTodayStar = todayStarOptions.find((option) => option.value === task.todayStar) || todayStarOptions[3];
	$: selectedTodayStarIcon =
		selectedTodayStar.value === 'none'
			? 'fa-regular fa-star'
			: selectedTodayStar.value === 'yellow'
				? 'fa-regular fa-star'
				: 'fa-solid fa-star';
	$: visibleModeBadge = showModeBadge && Boolean(task.mode) && task.mode !== 'All Modes' && $activeMode === 'All Modes';
	$: if (starMenuOpen && $hoveredTaskId !== task.id) {
		closeStarMenu();
	}
	$: if (!$draggedTask.id) {
		rowDropPlacement = null;
	}

	function energyIcon(energy) {
		if (energy === 'Focus') return 'fa-bullseye';
		if (energy === 'Admin') return 'fa-phone-volume';
		return 'fa-bolt';
	}

	function getModeBadgeTone(mode) {
		const normalizedMode = String(mode || '').toLowerCase();
		if (normalizedMode.includes('work')) return 'work';
		if (normalizedMode.includes('home')) return 'home';
		if (normalizedMode.includes('errand')) return 'errands';
		if (normalizedMode.includes('family')) return 'family';
		if (normalizedMode.includes('health')) return 'health';
		return 'default';
	}

	function saveEdit(event) {
		event?.stopPropagation?.();
		const nextTitle = stripDetectedDateText(draftTitle, editDateMatch);
		if (!nextTitle) return;
		skipEditBlurSave = true;
		updateTask(task.id, {
			title: nextTitle,
			dueDate: editDateMatch?.dueDate || task.dueDate || ''
		});
		editing = false;
	}

	function cancelEdit(event) {
		event?.stopPropagation?.();
		skipEditBlurSave = true;
		draftTitle = task.title;
		editDismissedPhrase = '';
		editing = false;
	}

	async function startEditing() {
		openTaskActions(task.id);
		editing = true;
		draftTitle = task.title;
		editDismissedPhrase = '';
		skipEditBlurSave = false;
		await tick();
		titleInput?.focus();
	}

	function handleEditKeydown(event) {
		if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
			event.preventDefault();
			const textarea = event.currentTarget;
			const selectionStart = textarea.selectionStart ?? draftTitle.length;
			const selectionEnd = textarea.selectionEnd ?? selectionStart;
			draftTitle = `${draftTitle.slice(0, selectionStart)}\n${draftTitle.slice(selectionEnd)}`;

			tick().then(() => {
				const nextCursor = selectionStart + 1;
				textarea.selectionStart = nextCursor;
				textarea.selectionEnd = nextCursor;
			});
			return;
		}

		if (event.key === 'Escape') {
			const selectionStart = event.currentTarget.selectionStart ?? 0;
			if (editDateMatch && isCursorInsideMatch(selectionStart, editDateMatch)) {
				editDismissedPhrase = editDateMatch.phrase.toLowerCase();
				event.preventDefault();
				return;
			}

			saveEdit();
			event.preventDefault();
			return;
		}

		if (event.key === 'Enter') {
			event.preventDefault();
			saveEdit();
		}
	}

	function handleEditBlur() {
		if (skipEditBlurSave) {
			skipEditBlurSave = false;
			return;
		}

		saveEdit();
	}

	function savePause() {
		pauseTask(task.id, pauseReasonDraft);
		pauseModalOpen = false;
	}

	function pauseNow() {
		pauseTask(task.id, '');
	}

	function saveDueDate() {
		updateTask(task.id, {
			dueDate: dueDateDraft || ''
		});
		closeDueDateMenu();
		dueDateModalOpen = false;
	}

	function setRelativeDueDate(offset) {
		const date = new Date();
		date.setHours(0, 0, 0, 0);
		date.setDate(date.getDate() + offset);
		const nextDueDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

		updateTask(task.id, {
			dueDate: nextDueDate
		});
		closeDueDateMenu();
	}

	function clearDueDate() {
		updateTask(task.id, {
			dueDate: ''
		});
		closeDueDateMenu();
	}

	function setFloatingMenuPosition(anchor, setPosition) {
		if (!anchor?.getBoundingClientRect) return;

		const rect = anchor.getBoundingClientRect();
		setPosition({
			top: rect.top - 8,
			left: rect.left + rect.width / 2
		});
	}

	function openDueDateMenu(anchor = dueDateButtonElement) {
		if (dueDateMenuCloseTimer) {
			clearTimeout(dueDateMenuCloseTimer);
			dueDateMenuCloseTimer = undefined;
		}

		setFloatingMenuPosition(anchor, (value) => {
			dueDateMenuPosition = value;
		});
		dueDateMenuOpen = true;
	}

	function scheduleDueDateMenuClose(delay = 3000) {
		if (dueDateMenuCloseTimer) {
			clearTimeout(dueDateMenuCloseTimer);
		}

		dueDateMenuCloseTimer = setTimeout(() => {
			dueDateMenuOpen = false;
			dueDateMenuCloseTimer = undefined;
		}, delay);
	}

	function closeDueDateMenu() {
		if (dueDateMenuCloseTimer) {
			clearTimeout(dueDateMenuCloseTimer);
			dueDateMenuCloseTimer = undefined;
		}

		dueDateMenuOpen = false;
	}

	function openStarMenu(anchor = starButtonElement) {
		if (starMenuCloseTimer) {
			clearTimeout(starMenuCloseTimer);
			starMenuCloseTimer = undefined;
		}

		setFloatingMenuPosition(anchor, (value) => {
			starMenuPosition = value;
		});
		starMenuOpen = true;
	}

	function handleStarTriggerEnter(anchor = starButtonElement) {
		starTriggerHovered = true;
		openStarMenu(anchor);
	}

	function scheduleStarMenuClose(delay = 3000) {
		if (starMenuCloseTimer) {
			clearTimeout(starMenuCloseTimer);
		}

		starMenuCloseTimer = setTimeout(() => {
			starMenuOpen = false;
			starMenuCloseTimer = undefined;
		}, delay);
	}

	function closeStarMenu() {
		if (starMenuCloseTimer) {
			clearTimeout(starMenuCloseTimer);
			starMenuCloseTimer = undefined;
		}

		starTriggerHovered = false;
		starMenuOpen = false;
	}

	function setTodayStar(value) {
		updateTask(task.id, {
			todayStar: value
		});
		closeStarMenu();
	}

	function setTaskMode(mode) {
		updateTask(task.id, {
			mode
		});
		modePickerOpen = false;
	}

	function handleTaskMouseLeave() {
		if (editing) return;
		scheduleTaskActionsClose(task.id);
	}

	function isInteractiveTarget(target) {
		return Boolean(target?.closest?.('button, a, input, textarea, select'));
	}

	function handleRowPointerDown(event) {
		if (editing || pauseModalOpen || dueDateModalOpen || isInteractiveTarget(event.target)) return;
		if (!event.target?.closest?.('.task-drag-handle')) return;

		pendingDrag = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY
		};
		
		try {
			event.target.releasePointerCapture(event.pointerId);
		} catch (e) {}
	}

	function handleWindowPointerDown(event) {
		if (disableOptions || !actionsOpen || editing || pauseModalOpen || dueDateModalOpen) return;
		if (taskLineElement?.contains(event.target)) return;
		if (dueDateMenuElement?.contains(event.target)) return;
		if (starMenuElement?.contains(event.target)) return;

		closeDueDateMenu();
		closeStarMenu();
		closeTaskActions(task.id);
	}

	function handleWindowPointerMove(event) {
		if (!pendingDrag || editing || pauseModalOpen || dueDateModalOpen) return;
		if (event.pointerId !== pendingDrag.pointerId) return;

		const movedX = Math.abs(event.clientX - pendingDrag.startX);
		const movedY = Math.abs(event.clientY - pendingDrag.startY);
		if (movedX < 8 && movedY < 8) return;

		if (!rowDragActive) {
			rowDragActive = true;
			suppressEditClick = true;
			startTaskDrag(task.id);
			closeTaskActions();
			document.body.classList.add('task-drag-active');
		}
	}

	function finishPointerDrag() {
		pendingDrag = null;
		if (rowDragActive) {
			if ($draggedTask.id && $draggedTask.targetId) {
				reorderTaskToTarget($draggedTask.id, $draggedTask.targetId, $draggedTask.placement);
			}
			rowDragActive = false;
			endTaskDrag();
			document.body.classList.remove('task-drag-active');
			setTimeout(() => {
				suppressEditClick = false;
			}, 0);
		}
	}

	function handleRowPointerMove(event) {
		if (!$draggedTask.id || $draggedTask.id === task.id || editing || pauseModalOpen || dueDateModalOpen) return;
		const rect = taskLineElement?.getBoundingClientRect?.();
		if (!rect) return;

		const placement = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
		rowDropPlacement = placement;
		updateTaskDragTarget(task.id, placement);
	}

	function handleRowPointerLeave() {
		if ($draggedTask.targetId === task.id) {
			updateTaskDragTarget(null);
		}
		rowDropPlacement = null;
	}

	function handleTaskTextActivate(event) {
		if (suppressEditClick || rowDragActive || $draggedTask.id) {
			event?.preventDefault?.();
			return;
		}

		startEditing();
	}

	function toggleActionMenu(event) {
		event?.stopPropagation?.();
		event?.preventDefault?.();
		if (disableOptions) return;

		if (actionsOpen) {
			closeTaskActions(task.id);
			closeDueDateMenu();
			closeStarMenu();
			modePickerOpen = false;
			return;
		}

		openTaskActions(task.id);
	}

	function handlePauseBackdropKeydown(event) {
		if (event.target !== event.currentTarget) return;
		if (['Enter', ' ', 'Escape'].includes(event.key)) {
			pauseModalOpen = false;
		}
	}

	function portal(node) {
		if (typeof document === 'undefined') {
			return {
				destroy() {}
			};
		}

		document.body.appendChild(node);

		return {
			destroy() {
				node.remove();
			}
		};
	}

	onMount(() => {
		window.addEventListener('pointerdown', handleWindowPointerDown);
		window.addEventListener('pointermove', handleWindowPointerMove);
		window.addEventListener('pointerup', finishPointerDrag);
		window.addEventListener('pointercancel', finishPointerDrag);

		return () => {
			window.removeEventListener('pointerdown', handleWindowPointerDown);
			window.removeEventListener('pointermove', handleWindowPointerMove);
			window.removeEventListener('pointerup', finishPointerDrag);
			window.removeEventListener('pointercancel', finishPointerDrag);
		};
	});

	onDestroy(() => {
		if (dueDateMenuCloseTimer) {
			clearTimeout(dueDateMenuCloseTimer);
		}
		if (starMenuCloseTimer) {
			clearTimeout(starMenuCloseTimer);
		}
	});
</script>

<div
	bind:this={taskLineElement}
	class="task-line"
	role="presentation"
	style={`opacity: ${task.done ? '0.72' : '1'};`}
	class:task-line-dragging={rowDragActive}
	class:task-line-drop-before={rowDropPlacement === 'before'}
	class:task-line-drop-after={rowDropPlacement === 'after'}
	onmouseenter={() => !disableOptions && openTaskActions(task.id)}
	onmouseleave={handleTaskMouseLeave}
	onpointermove={handleRowPointerMove}
	onpointerleave={handleRowPointerLeave}
>
	{#if editing}
		<div class="d-flex align-items-start justify-content-between gap-3 py-2 task-row-shell">
			<div class="d-flex align-items-start gap-2 flex-grow-1 min-w-0">
				<div class="min-w-0 flex-grow-1">
					<div class="task-edit-shell">
						<div class="task-edit-highlight" aria-hidden="true">
							<div class="task-edit-highlight-copy">
								{@html editDatePreview}
							</div>
						</div>
						<textarea
							bind:this={titleInput}
							class="task-edit-input"
							bind:value={draftTitle}
							rows="3"
							placeholder="Write action here"
						onkeydown={handleEditKeydown}
						onblur={handleEditBlur}
					></textarea>
					</div>
					{#if editDateMatch}
						<div class="soft-text small mt-2">
							Date detected for {formatDetectedDate(editDateMatch.dueDate)}. Press Escape on the highlighted date to keep it as text.
						</div>
					{/if}
				</div>
			</div>
			<div class="d-flex gap-2 flex-shrink-0">
				<button class="icon-button" type="button" aria-label={`Save ${task.title}`} onpointerdown={() => (skipEditBlurSave = true)} onclick={saveEdit}><i class="fa-solid fa-check"></i></button>
				<button class="icon-button" type="button" aria-label={`Cancel editing ${task.title}`} onpointerdown={() => (skipEditBlurSave = true)} onclick={cancelEdit}><i class="fa-solid fa-xmark"></i></button>
			</div>
		</div>
	{:else}
		<div
			class="d-flex align-items-start justify-content-between gap-3 py-2 task-row-shell"
			role="presentation"
			onpointerdown={handleRowPointerDown}
		>
			<div class="task-drag-handle" aria-hidden="true">
				<i class="fa-solid fa-grip-vertical"></i>
			</div>
			<div class="d-flex align-items-start gap-2 flex-grow-1 min-w-0">
				<div class="min-w-0 flex-grow-1">
					{#if task.paused}
						<div class="d-flex flex-wrap align-items-center gap-2">
							<div class="task-title text-warning">
								<i class="fa-solid fa-pause me-2"></i>Paused
							</div>
							<button
								class="task-inline-link"
								type="button"
								onclick={() => {
									pauseReasonDraft = task.pauseReason || '';
									pauseModalOpen = true;
								}}
							>
								{hasPauseReason ? 'Edit reason' : 'Add reason'}
							</button>
						</div>
						{#if hasPauseReason}
							<div class="paused-reason mt-1">{task.pauseReason}</div>
							<div class="paused-reason-task soft-text">{task.title}</div>
						{:else}
							<div class={`task-title mt-1 ${task.done ? 'text-decoration-line-through soft-text' : ''}`}>{task.title}</div>
						{/if}
						{#if visibleModeBadge}
							<div class="task-meta-row mt-1">
								<div class={`task-mode-meta ${getModeBadgeTone(task.mode)}`} aria-label={`Mode ${task.mode}`}>
									<i class="fa-solid {getModeIcon(task.mode, $modeIcons)}" aria-hidden="true"></i>
									<span>{task.mode}</span>
								</div>
							</div>
						{/if}
					{:else}
						<div
							class="d-flex flex-wrap align-items-center gap-2 task-text-line"
							role="button"
							tabindex="0"
							aria-label={`Edit ${task.title}`}
							onclick={handleTaskTextActivate}
							onkeydown={(event) => ['Enter', ' '].includes(event.key) && handleTaskTextActivate(event)}
						>
							<div class={`task-title ${task.done ? 'text-decoration-line-through soft-text' : ''}`}>{task.title}</div>
						</div>
						{#if task.dueDate || visibleModeBadge}
							<div class="task-meta-row mt-1">
								{#if task.dueDate}
									<div class="task-due-note">
										<i class="fa-regular fa-calendar me-2"></i>{formatDetectedDate(task.dueDate)}
									</div>
								{/if}
								{#if visibleModeBadge}
									<div class={`task-mode-meta ${getModeBadgeTone(task.mode)}`} aria-label={`Mode ${task.mode}`}>
										<i class="fa-solid {getModeIcon(task.mode, $modeIcons)}" aria-hidden="true"></i>
										<span>{task.mode}</span>
									</div>
								{/if}
							</div>
						{/if}
					{/if}
				</div>
			</div>
			<div class="d-flex align-items-center gap-1 flex-shrink-0">
				{#if showTodayStarControls}
					<div
						class="task-inline-action-group"
						role="presentation"
						onmouseenter={() => handleStarTriggerEnter(starButtonElement)}
						onmouseleave={() => scheduleStarMenuClose()}
					>
						<button
							bind:this={starButtonElement}
							class={`icon-button task-star-trigger ${task.todayStar !== 'none' ? task.todayStar : ''}`}
							type="button"
							aria-label={`Set star for ${task.title}`}
							title={selectedTodayStar.meaning}
							onmouseenter={() => handleStarTriggerEnter(starButtonElement)}
							onclick={() => (starMenuOpen ? closeStarMenu() : handleStarTriggerEnter(starButtonElement))}
						>
							<i class={selectedTodayStarIcon}></i>
						</button>
					</div>
				{/if}
				<button
					class={`icon-button task-options-trigger ${actionsOpen ? 'active' : ''}`}
					type="button"
					aria-label={`Open options for ${task.title}`}
					aria-expanded={actionsOpen}
					onmouseenter={closeStarMenu}
					onclick={toggleActionMenu}
				>
					<i class="fa-solid fa-ellipsis"></i>
				</button>
			</div>
		</div>
	{/if}

	{#if !editing}
		<div
			class={`row-actions task-inline-actions d-flex gap-1 ${actionsOpen ? 'visible' : ''}`}
		role="presentation"
		onmouseenter={closeStarMenu}
	>
		{#if task.paused}
			<button
				class="icon-button"
				type="button"
				aria-label={`Change mode for ${task.title}`}
				onclick={() => (modePickerOpen = true)}
			><i class="fa-solid fa-layer-group"></i></button>
			<button
				class="icon-button"
				type="button"
				aria-label={`Resume ${task.title}`}
				onclick={() => resumeTask(task.id)}
			>
				<i class="fa-solid fa-play"></i>
			</button>
			<button class="icon-button" type="button" aria-label={`Edit pause reason for ${task.title}`} onclick={() => (pauseModalOpen = true)}><i class="fa-solid fa-comment-dots"></i></button>
		{:else}
			<button class="icon-button" type="button" aria-label={`Mark ${task.title} done`} onclick={() => toggleTask(task.id)}><i class="fa-solid fa-check"></i></button>
			<button class="icon-button" type="button" aria-label={`Pause ${task.title}`} onclick={pauseNow}><i class="fa-solid fa-pause"></i></button>
			<div
				class="task-inline-action-group"
				role="presentation"
				onmouseenter={() => openDueDateMenu(dueDateButtonElement)}
				onmouseleave={() => scheduleDueDateMenuClose()}
			>
				<button
					bind:this={dueDateButtonElement}
					class="icon-button"
					type="button"
					aria-label={`Set due date for ${task.title}`}
					onclick={() => (dueDateMenuOpen ? closeDueDateMenu() : openDueDateMenu(dueDateButtonElement))}
				><i class="fa-regular fa-calendar"></i></button>
			</div>
			<button
				class="icon-button"
				type="button"
				aria-label={`Change mode for ${task.title}`}
				onclick={() => (modePickerOpen = true)}
			><i class="fa-solid fa-layer-group"></i></button>
			<button class="icon-button" type="button" aria-label={`Edit ${task.title}`} onclick={startEditing}><i class="fa-solid fa-pen"></i></button>
		{/if}
		<button class="icon-button" type="button" aria-label={`Delete ${task.title}`} onclick={() => removeTask(task.id)}><i class="fa-solid fa-trash"></i></button>
	</div>
	{/if}
</div>

{#if dueDateMenuOpen}
	<div
		use:portal
		bind:this={dueDateMenuElement}
		class="task-inline-submenu task-inline-submenu-floating"
		role="presentation"
		style={`top:${dueDateMenuPosition.top}px;left:${dueDateMenuPosition.left}px;`}
		onmouseenter={() => openDueDateMenu(dueDateButtonElement)}
		onmouseleave={() => scheduleDueDateMenuClose()}
	>
		<button class="task-inline-submenu-button" type="button" onclick={() => setRelativeDueDate(0)}>Today</button>
		<button class="task-inline-submenu-button" type="button" onclick={() => setRelativeDueDate(1)}>Tomorrow</button>
		<button class="task-inline-submenu-button" type="button" onclick={clearDueDate}>Remove date</button>
		<button class="task-inline-submenu-button" type="button" onclick={() => {
			closeDueDateMenu();
			dueDateModalOpen = true;
		}}>Later</button>
	</div>
{/if}

{#if modePickerOpen}
	<div
		use:portal
		class="pause-modal-backdrop"
		role="button"
		tabindex="0"
		aria-label="Close mode picker"
		onclick={() => (modePickerOpen = false)}
		onkeydown={(event) => event.target === event.currentTarget && ['Enter', ' ', 'Escape'].includes(event.key) && (modePickerOpen = false)}
	>
		<div
			class="pause-modal mode-picker-sheet"
			role="dialog"
			aria-modal="true"
			aria-labelledby={`mode-picker-title-${task.id}`}
			tabindex="0"
			onclick={(event) => event.stopPropagation()}
			onkeydown={(event) => event.key === 'Escape' && (modePickerOpen = false)}
		>
			<div class="d-flex justify-content-between align-items-start gap-3 mb-3">
				<div>
					<div class="section-label">Change Mode</div>
					<h2 class="h6 mt-2 mb-1" id={`mode-picker-title-${task.id}`}>{task.title}</h2>
					<p class="soft-text small mb-0">Move this action into the mode that fits best right now.</p>
				</div>
				<button class="icon-button" type="button" aria-label="Close mode picker" onclick={() => (modePickerOpen = false)}>
					<i class="fa-solid fa-xmark"></i>
				</button>
			</div>

			<div class="mode-picker-grid">
				{#each selectableModes as mode}
						<button
							class={`mode-picker-button ${task.mode === mode ? 'active' : ''}`}
							type="button"
							onclick={() => setTaskMode(mode)}
						>
							<div class="d-flex align-items-center gap-2">
								<i class="fa-solid {getModeIcon(mode, $modeIcons)}"></i>
								<span>{mode}</span>
							</div>
						{#if task.mode === mode}
							<i class="fa-solid fa-check"></i>
						{/if}
					</button>
				{/each}
			</div>
		</div>
	</div>
{/if}

{#if starMenuOpen}
	<div
		use:portal
		bind:this={starMenuElement}
		class="task-inline-submenu task-inline-submenu-stack task-inline-submenu-floating task-star-menu"
		role="presentation"
		style={`top:${starMenuPosition.top}px;left:${starMenuPosition.left}px;`}
		onmouseenter={() => handleStarTriggerEnter(starButtonElement)}
		onmouseleave={() => scheduleStarMenuClose()}
	>
		{#each todayStarOptions as starOption}
			<button
				class={`task-inline-submenu-button task-star-choice ${task.todayStar === starOption.value ? 'active' : ''} ${starOption.value !== 'none' ? starOption.value : ''}`}
				type="button"
				aria-label={starOption.meaning}
				title={starOption.meaning}
				onclick={() => setTodayStar(starOption.value)}
			>
				<i class={starOption.value === 'none' || starOption.value === 'yellow' ? 'fa-regular fa-star' : 'fa-solid fa-star'}></i>
			</button>
		{/each}
	</div>
{/if}

{#if pauseModalOpen}
	<div
		use:portal
		class="pause-modal-backdrop"
		role="button"
		tabindex="0"
		aria-label="Close pause reason modal"
		onclick={() => (pauseModalOpen = false)}
		onkeydown={handlePauseBackdropKeydown}
	>
		<div
			class="pause-modal"
			role="dialog"
			aria-modal="true"
			aria-labelledby={`pause-modal-title-${task.id}`}
			tabindex="0"
			onclick={(event) => event.stopPropagation()}
			onkeydown={(event) => event.key === 'Escape' && (pauseModalOpen = false)}
		>
			<div class="d-flex justify-content-between align-items-start gap-3 mb-3">
				<div>
					<div class="section-label">Pause Action</div>
					<h2 class="h6 mt-2 mb-1" id={`pause-modal-title-${task.id}`}>{task.title}</h2>
					<p class="soft-text small mb-0">Optional: add the blocker or reason so the action shows that instead of the action itself.</p>
				</div>
				<button class="icon-button" type="button" aria-label="Close pause modal" onclick={() => (pauseModalOpen = false)}>
					<i class="fa-solid fa-xmark"></i>
				</button>
			</div>

			<label class="form-label soft-text" for={`pause-reason-${task.id}`}>Why is this paused?</label>
			<textarea
				id={`pause-reason-${task.id}`}
				class="form-control"
				rows="4"
				bind:value={pauseReasonDraft}
				placeholder="Example: Waiting for a callback from finance with the corrected amount before I can send the final invoice."
			></textarea>

			<div class="d-flex justify-content-end gap-2 mt-3">
				<button class="toolbar-button" type="button" onclick={() => (pauseModalOpen = false)}>Cancel</button>
				<button class="toolbar-button active" type="button" onclick={savePause}>Save reason</button>
			</div>
		</div>
	</div>
{/if}

{#if dueDateModalOpen}
	<div
		use:portal
		class="pause-modal-backdrop"
		role="button"
		tabindex="0"
		aria-label="Close due date modal"
		onclick={() => (dueDateModalOpen = false)}
		onkeydown={handlePauseBackdropKeydown}
	>
		<div
			class="pause-modal"
			role="dialog"
			aria-modal="true"
			aria-labelledby={`due-date-modal-title-${task.id}`}
			tabindex="0"
			onclick={(event) => event.stopPropagation()}
			onkeydown={(event) => event.key === 'Escape' && (dueDateModalOpen = false)}
		>
			<div class="d-flex justify-content-between align-items-start gap-3 mb-3">
				<div>
					<div class="section-label">Due Date</div>
					<h2 class="h6 mt-2 mb-1" id={`due-date-modal-title-${task.id}`}>{task.title}</h2>
					<p class="soft-text small mb-0">Pick a date for this action or clear it if you want to remove the due date.</p>
				</div>
				<button class="icon-button" type="button" aria-label="Close due date modal" onclick={() => (dueDateModalOpen = false)}>
					<i class="fa-solid fa-xmark"></i>
				</button>
			</div>

			<label class="form-label soft-text" for={`due-date-input-${task.id}`}>Due date</label>
			<input
				id={`due-date-input-${task.id}`}
				class="form-control"
				type="date"
				bind:value={dueDateDraft}
			/>

			<div class="d-flex justify-content-end gap-2 mt-3">
				<button class="toolbar-button" type="button" onclick={() => (dueDateModalOpen = false)}>Cancel</button>
				<button class="toolbar-button" type="button" onclick={() => {
					dueDateDraft = '';
					saveDueDate();
				}}>Clear date</button>
				<button class="toolbar-button active" type="button" onclick={saveDueDate}>Save date</button>
			</div>
		</div>
	</div>
{/if}
