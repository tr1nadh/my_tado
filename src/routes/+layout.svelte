<script>
	import '../app.css';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { beforeNavigate, goto } from '$app/navigation';
	import {
		checkForDesktopUpdates,
		desktopUpdate,
		dismissDesktopUpdate,
		initDesktopUpdater,
		installDesktopUpdate
	} from '$lib/desktopUpdater';
	import {
		activeMode,
		getActiveModeTimeBlock,
		getModeIcon,
		initTasks,
		modeIcons,
		modes,
		renameMode,
		settings,
		settingsReady
	} from '$lib/tasks';
	import { toast } from '$lib/toast';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import IslandNav from '$lib/components/IslandNav.svelte';

	const { children } = $props();
	let modeEditorOpen = $state(false);
	let modeEditorKind = $state('create');
	let modeDraft = $state('');
	let modeError = $state('');
	let modeMenuOpenFor = $state(null);
	let modeActionTarget = $state('All Modes');
	let draggedMode = $state(null);
	const todayDateNumber = new Date().getDate();
	const isHomePage = $derived(page.url.pathname === '/');
	let navLockToastAt = $state(0);
	let navRedirectToastAt = $state(0);
	let navRedirectInFlight = $state(false);

	const navItems = [{ href: '/today', label: 'Today', description: 'Due now', icon: 'date' }];
	const searchableRoutes = new Set(navItems.map((item) => item.href));

	onMount(() => {
		initTasks();
		initDesktopUpdater();

		const unsubscribeBefore = beforeNavigate((navigation) => {
			if (navigation.type === 'leave') return;
			if (!$settingsReady) return;

			const activeBlock = getActiveModeTimeBlock($settings, new Date());
			if (!activeBlock) return;

			const nextPath = navigation.to?.url?.pathname;
			if (!nextPath || nextPath === '/today') return;

			navigation.cancel();

			const now = Date.now();
			if (now - navLockToastAt > 900) {
				navLockToastAt = now;
				toast.show('Auto schedule is active. Stay on Today until your current block ends.', 'lock');
			}
		});

		function enforceTodayOnly() {
			if (!$settingsReady) return;

			const activeBlock = getActiveModeTimeBlock($settings, new Date());
			if (!activeBlock) return;
			if (window.location.pathname === '/today') return;
			if (navRedirectInFlight) return;

			const now = Date.now();
			if (now - navRedirectToastAt > 1500) {
				navRedirectToastAt = now;
				toast.show('Auto schedule is active. Redirecting to Today.', 'lock');
			}

			navRedirectInFlight = true;
			goto('/today', { replaceState: true }).finally(() => {
				navRedirectInFlight = false;
			});
		}

		// Catch direct loads to non-Today routes and block-start transitions while user is elsewhere.
		enforceTodayOnly();
		const lockInterval = setInterval(enforceTodayOnly, 15000);
		window.addEventListener('focus', enforceTodayOnly);
		window.addEventListener('pageshow', enforceTodayOnly);
		const handleVisibilityChange = () => {
			if (document.hidden) return;
			enforceTodayOnly();
		};
		document.addEventListener('visibilitychange', handleVisibilityChange);

		return () => {
			unsubscribeBefore?.();
			clearInterval(lockInterval);
			window.removeEventListener('focus', enforceTodayOnly);
			window.removeEventListener('pageshow', enforceTodayOnly);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
	});

	function triggerMobileSearch() {
		window.dispatchEvent(new CustomEvent('karya:mobile-search'));
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
		event?.stopPropagation?.();
		if (modeMenuOpenFor === mode) {
			modeMenuOpenFor = null;
			return;
		}

		modeMenuOpenFor = mode;
		modeActionTarget = mode;
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
		return 'Deleting a mode moves its actions into All Modes.';
	}

	function isDateIcon(item) {
		return item.icon === 'date';
	}
</script>

<div class="position-relative">
	<div class="app-shell">
		{#if !isHomePage}
			<header class="mobile-topbar glass-panel">
				<div class="mobile-topbar-spacer" aria-hidden="true"></div>
				<div class="mobile-topbar-title">Karya</div>
				{#if searchableRoutes.has(page.url.pathname)}
					<button class="icon-button" type="button" aria-label="Search actions" onclick={triggerMobileSearch}>
						<i class="fa-solid fa-magnifying-glass"></i>
					</button>
				{:else}
					<div class="mobile-topbar-spacer"></div>
				{/if}
			</header>
		{/if}



		<div class={`app-content ${isHomePage ? 'home-shell' : 'has-island-nav'}`}>
			{#if page.url.pathname !== '/today' && page.url.pathname !== '/' && page.url.pathname !== '/upcoming' && page.url.pathname !== '/inbox' && page.url.pathname !== '/settings'}
				<section class="top-mode-bar">
					<div class="container-fluid py-3 px-3 px-lg-4">
						<div class="mode-strip">
							<div class="d-flex align-items-center justify-content-between w-100">
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
												<div class="nav-item-icon">
													<i class="fa-solid {getModeIcon(mode, $modeIcons)}"></i>
												</div>
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

								<!-- Clock is shown in Today header when Auto schedule is enabled. -->
							</div>
						</div>
					</div>
				</section>
			{/if}

			<div class="container-fluid pt-4 pt-lg-4 pb-4 pb-lg-5 px-3 px-lg-4">
				{@render children()}
			</div>
			<div class="app-love-note" aria-label="made in love with india">
				made in <i class="fa-solid fa-heart app-love-heart" aria-hidden="true"></i> with india.
			</div>
			{#if !isHomePage}
				<IslandNav />
			{/if}
		</div>
	</div>
</div>

<ToastContainer />



{#if $desktopUpdate.available}
	<div
		class="pause-modal-backdrop"
		role="button"
		tabindex="0"
		aria-label="Close update prompt"
		onclick={dismissDesktopUpdate}
		onkeydown={(event) => event.target === event.currentTarget && ['Enter', ' ', 'Escape'].includes(event.key) && dismissDesktopUpdate()}
	>
		<div
			class="pause-modal update-modal"
			role="dialog"
			aria-modal="true"
			aria-labelledby="desktop-update-title"
			tabindex="0"
			onclick={(event) => event.stopPropagation()}
			onkeydown={(event) => event.key === 'Escape' && dismissDesktopUpdate()}
		>
			<div class="d-flex justify-content-between align-items-start gap-3 mb-3">
				<div>
					<div class="section-label">Desktop Update</div>
					<h2 class="h6 mt-2 mb-1" id="desktop-update-title">Karya {$desktopUpdate.version} is ready</h2>
					<p class="soft-text small mb-0">
						Current version {$desktopUpdate.currentVersion}. Install the latest desktop build and restart into it.
					</p>
				</div>
				<button class="icon-button" type="button" aria-label="Close update prompt" onclick={dismissDesktopUpdate}>
					<i class="fa-solid fa-xmark"></i>
				</button>
			</div>

			{#if $desktopUpdate.body}
				<div class="update-notes mb-3">{$desktopUpdate.body}</div>
			{/if}

			{#if $desktopUpdate.error}
				<div class="mode-editor-error mb-3">{$desktopUpdate.error}</div>
			{/if}

			<div class="d-flex justify-content-end gap-2 mt-3">
				<button class="toolbar-button" type="button" onclick={dismissDesktopUpdate}>Later</button>
				<button class="toolbar-button" type="button" onclick={() => checkForDesktopUpdates()} disabled={$desktopUpdate.checking || $desktopUpdate.installing}>
					Check again
				</button>
				<button class="toolbar-button active" type="button" onclick={installDesktopUpdate} disabled={$desktopUpdate.installing}>
					{$desktopUpdate.installing ? 'Installing…' : 'Update now'}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if modeMenuOpenFor}
	<div
		class="pause-modal-backdrop"
		role="button"
		tabindex="0"
		aria-label="Close mode actions"
		onclick={() => (modeMenuOpenFor = null)}
		onkeydown={(event) => event.target === event.currentTarget && ['Enter', ' ', 'Escape'].includes(event.key) && (modeMenuOpenFor = null)}
	>
		<div
			class="pause-modal mode-actions-sheet"
			role="dialog"
			aria-modal="true"
			aria-labelledby="mode-actions-title"
			tabindex="0"
			onclick={(event) => event.stopPropagation()}
			onkeydown={(event) => event.key === 'Escape' && (modeMenuOpenFor = null)}
		>
			<div class="d-flex justify-content-between align-items-start gap-3 mb-3">
				<div>
					<div class="section-label">Mode Actions</div>
					<h2 class="h6 mt-2 mb-1" id="mode-actions-title">{modeMenuOpenFor}</h2>
					<p class="soft-text small mb-0">Manage this mode without fighting the top strip layout.</p>
				</div>
				<button class="icon-button" type="button" aria-label="Close mode actions" onclick={() => (modeMenuOpenFor = null)}>
					<i class="fa-solid fa-xmark"></i>
				</button>
			</div>

			<div class="mode-actions-grid">
				<button class="mode-pill-menu-button" type="button" onclick={() => openModeAction('rename', modeMenuOpenFor)}>
					<i class="fa-solid fa-pen"></i>
					<span>Edit</span>
				</button>
				<button class="mode-pill-menu-button danger" type="button" onclick={() => openModeAction('delete', modeMenuOpenFor)}>
					<i class="fa-solid fa-trash"></i>
					<span>Delete</span>
				</button>
			</div>
		</div>
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
