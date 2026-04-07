<script>
	import '../app.css';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import {
		activeMode,
		createMode,
		deleteMode,
		initTasks,
		moveModeToIndex,
		modes,
		renameMode
	} from '$lib/tasks';

	const { children } = $props();
	let navCollapsed = $state(false);
	let modeEditorOpen = $state(false);
	let modeEditorKind = $state('create');
	let modeDraft = $state('');
	let modeError = $state('');
	let modeMenuOpenFor = $state(null);
	let modeActionTarget = $state('All Modes');
	let draggedMode = $state(null);
	let modeMenuPosition = $state({ top: 0, left: 0 });

	const navItems = [
		{ href: '/today', label: 'Today', description: 'Due now' },
		{ href: '/upcoming', label: 'Upcoming', description: 'Plan ahead' },
		{ href: '/inbox', label: 'All Actions', description: 'Everything by mode' }
	];

	function getModeIcon(mode) {
		if (mode === 'Work Sprint') return 'fa-briefcase';
		if (mode === 'Home Reset') return 'fa-house';
		if (mode === 'Errands') return 'fa-location-dot';
		if (mode === 'Family Loop') return 'fa-user-group';
		if (mode === 'Health Check') return 'fa-heart-pulse';
		return 'fa-layer-group';
	}

	onMount(() => {
		initTasks();
		navCollapsed = localStorage.getItem('saas-nav-collapsed') === 'true';

		function handleWindowPointer(event) {
			const target = event.target;
			if (target instanceof Element && target.closest('.mode-settings-button, .mode-pill-menu-floating')) return;
			modeMenuOpenFor = null;
		}

		function closeModeMenu() {
			modeMenuOpenFor = null;
		}

		window.addEventListener('pointerdown', handleWindowPointer);
		window.addEventListener('resize', closeModeMenu);
		window.addEventListener('scroll', closeModeMenu, true);

		return () => {
			window.removeEventListener('pointerdown', handleWindowPointer);
			window.removeEventListener('resize', closeModeMenu);
			window.removeEventListener('scroll', closeModeMenu, true);
		};
	});

	function toggleNav() {
		navCollapsed = !navCollapsed;
		localStorage.setItem('saas-nav-collapsed', String(navCollapsed));
	}

	function openModeEditor(kind, mode = $activeMode) {
		modeEditorKind = kind;
		modeError = '';
		modeActionTarget = mode;
		modeDraft = kind === 'rename' ? mode : '';
		modeEditorOpen = true;
		modeMenuOpenFor = null;
	}

	function closeModeEditor() {
		modeEditorOpen = false;
		modeError = '';
		modeDraft = '';
	}

	function openModeAction(kind, mode) {
		modeMenuOpenFor = null;
		openModeEditor(kind, mode);
	}

	function submitModeEditor() {
		if (modeEditorKind === 'create') {
			if (createMode(modeDraft)) {
				closeModeEditor();
				return;
			}

			modeError = 'Pick a unique mode name.';
			return;
		}

		if (modeEditorKind === 'rename') {
			if (renameMode(modeActionTarget, modeDraft)) {
				closeModeEditor();
				return;
			}

			modeError = 'That rename is not available.';
			return;
		}

		if (modeEditorKind === 'delete') {
			if (deleteMode(modeActionTarget)) {
				closeModeEditor();
				return;
			}

			modeError = 'At least one custom mode must remain.';
		}
	}

	function toggleModeMenu(event, mode) {
		if (modeMenuOpenFor === mode) {
			modeMenuOpenFor = null;
			return;
		}

		const rect = event.currentTarget?.getBoundingClientRect?.();
		if (rect) {
			modeMenuPosition = {
				top: rect.bottom + 10,
				left: rect.right
			};
		}

		modeMenuOpenFor = mode;
	}

	function handleModeDragStart(event, mode) {
		if (mode === 'All Modes') return;
		event.dataTransfer?.setData('text/plain', mode);
		event.dataTransfer?.setDragImage(event.currentTarget, 24, 24);
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
		}
		draggedMode = mode;
		modeMenuOpenFor = null;
	}

	function handleModeDragEnter(targetMode) {
		if (!draggedMode || draggedMode === targetMode || targetMode === 'All Modes') return;
		moveModeToIndex(draggedMode, $modes.indexOf(targetMode));
	}

	function handleModeDrop(event, targetMode) {
		event.preventDefault();
		if (!draggedMode || draggedMode === targetMode || targetMode === 'All Modes') {
			draggedMode = null;
			return;
		}

		moveModeToIndex(draggedMode, $modes.indexOf(targetMode));
		draggedMode = null;
	}

	function clearDraggedMode() {
		draggedMode = null;
	}

	function editorTitle() {
		if (modeEditorKind === 'create') return 'Create mode';
		if (modeEditorKind === 'rename') return 'Rename mode';
		return 'Delete mode';
	}

	function editorCopy() {
		if (modeEditorKind === 'create') return 'Add a fresh lane for a new slice of work.';
		if (modeEditorKind === 'rename') return 'Tighten the wording without losing any actions already in this mode.';
		return 'Deleting a mode moves its actions into the next available mode.';
	}
</script>

<div class="position-relative">
	<div class="app-shell">
		<aside class={`glass-panel side-dock fade-up ${navCollapsed ? 'collapsed' : ''}`}>
			<div class={`d-flex ${navCollapsed ? 'justify-content-center' : 'align-items-center'} gap-3 mb-4`}>
						<div class:nav-copy-hidden={navCollapsed}>
							<div class="sidebar-title">Karya</div>
						</div>
					<button
						class="icon-button ms-auto d-none d-xl-inline-flex"
						type="button"
						aria-label={navCollapsed ? 'Expand side navigation' : 'Collapse side navigation'}
						title={navCollapsed ? 'Expand nav' : 'Collapse nav'}
						onclick={toggleNav}
					>
						<i class={`fa-solid ${navCollapsed ? 'fa-angles-right' : 'fa-angles-left'}`}></i>
					</button>
			</div>

			<div class="d-grid gap-2 mb-4">
				{#each navItems as item}
					<a
						class={`nav-item-button ${page.url.pathname === item.href ? 'active' : ''}`}
						href={item.href}
						title={item.label}
					>
						<span class="text-start">
							<span class="d-block fw-semibold">{item.label}</span>
							<span class="soft-text small">{item.description}</span>
						</span>
					</a>
				{/each}
			</div>
		</aside>

		<div class={`app-content ${navCollapsed ? 'nav-collapsed' : ''}`}>
			<section class="top-mode-bar">
				<div class="container-fluid py-3 px-3 px-lg-4">
					<div class="mode-strip">
						<div>
							<div class="d-flex gap-2 mode-scroller">
								{#each $modes as mode}
									<div
										class={`mode-pill-shell flex-shrink-0 ${draggedMode === mode ? 'dragging' : ''}`}
										role="presentation"
										draggable={mode !== 'All Modes'}
										ondragstart={(event) => handleModeDragStart(event, mode)}
										ondragend={clearDraggedMode}
										ondragover={(event) => {
											event.preventDefault();
											if (event.dataTransfer) {
												event.dataTransfer.dropEffect = 'move';
											}
										}}
										ondragenter={() => handleModeDragEnter(mode)}
										ondrop={(event) => handleModeDrop(event, mode)}
									>
										<button
											type="button"
											class={`mode-pill ${$activeMode === mode ? 'active with-settings' : ''}`}
											onclick={() => {
												activeMode.set(mode);
												modeMenuOpenFor = null;
											}}
										>
											<i class={`fa-solid ${getModeIcon(mode)}`}></i>
											<span class="mode-pill-label">{mode}</span>
										</button>
										{#if mode !== 'All Modes' && $activeMode === mode}
											<button
												class="mode-settings-button"
												type="button"
												aria-label={`Manage ${mode}`}
												onclick={(event) => {
													event.stopPropagation();
													toggleModeMenu(event, mode);
												}}
											>
												<i class="fa-solid fa-gear"></i>
											</button>
										{/if}
									</div>
								{/each}
								<button class="mode-pill mode-pill-create flex-shrink-0" type="button" aria-label="Create mode" onclick={() => openModeEditor('create')}>
									<i class="fa-solid fa-plus"></i>
								</button>
							</div>
						</div>
					</div>
				</div>
			</section>

			<div class="container-fluid pt-4 pt-lg-4 pb-4 pb-lg-5 px-3 px-lg-4">
				{@render children()}
			</div>
		</div>
	</div>
</div>

{#if modeMenuOpenFor}
	<div
		class="mode-pill-menu mode-pill-menu-floating"
		style={`top: ${modeMenuPosition.top}px; left: ${modeMenuPosition.left}px;`}
	>
		<button class="mode-pill-menu-button" type="button" onclick={() => openModeAction('rename', modeMenuOpenFor)}>
			<i class="fa-solid fa-pen"></i>
			<span>Edit</span>
		</button>
		<button class="mode-pill-menu-button danger" type="button" onclick={() => openModeAction('delete', modeMenuOpenFor)}>
			<i class="fa-solid fa-trash"></i>
			<span>Delete</span>
		</button>
	</div>
{/if}

{#if modeEditorOpen}
	<div
		class="pause-modal-backdrop"
		role="button"
		tabindex="0"
		aria-label="Close mode editor"
		onclick={closeModeEditor}
		onkeydown={(event) => event.target === event.currentTarget && ['Enter', ' ', 'Escape'].includes(event.key) && closeModeEditor()}
	>
		<div
			class="pause-modal mode-editor-modal"
			role="dialog"
			aria-modal="true"
			aria-labelledby="mode-editor-title"
			tabindex="0"
			onclick={(event) => event.stopPropagation()}
			onkeydown={(event) => event.key === 'Escape' && closeModeEditor()}
		>
			<div class="d-flex justify-content-between align-items-start gap-3 mb-3">
				<div>
					<div class="section-label">Mode Manager</div>
					<h2 class="h6 mt-2 mb-1" id="mode-editor-title">{editorTitle()}</h2>
					<p class="soft-text small mb-0">{editorCopy()}</p>
				</div>
				<button class="icon-button" type="button" aria-label="Close mode editor" onclick={closeModeEditor}>
					<i class="fa-solid fa-xmark"></i>
				</button>
			</div>

			{#if modeEditorKind === 'delete'}
				<div class="mode-delete-card">
					<div class="mode-delete-name">
						<i class={`fa-solid ${getModeIcon(modeActionTarget)}`}></i>
						<span>{modeActionTarget}</span>
					</div>
					<div class="soft-text small">Its actions will be moved into another available mode automatically.</div>
				</div>
			{:else}
				<label class="form-label soft-text" for="mode-name-input">
					{modeEditorKind === 'create' ? 'Mode name' : 'New mode name'}
				</label>
				<input
					id="mode-name-input"
					class="form-control"
					type="text"
					bind:value={modeDraft}
					placeholder={modeEditorKind === 'create' ? 'Example: Deep Work' : 'Update this mode name'}
					onkeydown={(event) => event.key === 'Enter' && submitModeEditor()}
				/>
			{/if}

			{#if modeError}
				<div class="mode-editor-error mt-3">{modeError}</div>
			{/if}

			<div class="d-flex justify-content-end gap-2 mt-3">
				<button class="toolbar-button" type="button" onclick={closeModeEditor}>Cancel</button>
				<button
					class={`toolbar-button ${modeEditorKind === 'delete' ? '' : 'active'}`}
					type="button"
					onclick={submitModeEditor}
				>
					{modeEditorKind === 'create' ? 'Create mode' : modeEditorKind === 'rename' ? 'Save name' : 'Delete mode'}
				</button>
			</div>
		</div>
	</div>
{/if}
