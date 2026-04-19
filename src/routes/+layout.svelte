<script>
	import '../app.css';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import {
		checkForDesktopUpdates,
		desktopUpdate,
		dismissDesktopUpdate,
		initDesktopUpdater,
		installDesktopUpdate
	} from '$lib/desktopUpdater';
	import {
		activeMode,
		getModeIcon,
		initTasks,
		modeIcons,
		modes,
		renameMode
	} from '$lib/tasks';
	import GlobalClock from '$lib/components/GlobalClock.svelte';

	const { children } = $props();
	let navCollapsed = $state(false);
	let modeEditorOpen = $state(false);
	let modeEditorKind = $state('create');
	let modeDraft = $state('');
	let modeError = $state('');
	let modeMenuOpenFor = $state(null);
	let mobileNavOpen = $state(false);
	let modeActionTarget = $state('All Modes');
	let draggedMode = $state(null);
	const todayDateNumber = new Date().getDate();
	const isHomePage = $derived(page.url.pathname === '/');

	const navItems = [
		{ href: '/today', label: 'Today', description: 'Due now', icon: 'date' },
		{ href: '/upcoming', label: 'Upcoming', description: 'Plan ahead', icon: 'fa-calendar-days' }
	];

	const settingsNavItem = { href: '/settings', label: 'Settings', description: 'Personalize Karya', icon: 'fa-sliders' };
	const searchableRoutes = new Set(navItems.map((item) => item.href));

	onMount(() => {
		initTasks();
		initDesktopUpdater();
		navCollapsed = localStorage.getItem('saas-nav-collapsed') === 'true';

		return () => {
		};
	});

	function toggleNav() {
		navCollapsed = !navCollapsed;
		localStorage.setItem('saas-nav-collapsed', String(navCollapsed));
	}

	function handleSideNavKeydown(event) {
		if (event.key === 'ArrowLeft' && !navCollapsed) {
			event.preventDefault();
			navCollapsed = true;
			localStorage.setItem('saas-nav-collapsed', 'true');
		}

		if (event.key === 'ArrowRight' && navCollapsed) {
			event.preventDefault();
			navCollapsed = false;
			localStorage.setItem('saas-nav-collapsed', 'false');
		}
	}

	function closeMobileNav() {
		mobileNavOpen = false;
	}

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
				<button class="icon-button" type="button" aria-label="Open navigation" onclick={() => (mobileNavOpen = true)}>
					<i class="fa-solid fa-bars"></i>
				</button>
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

		{#if !isHomePage}
			<aside class={`glass-panel side-dock side-dock-layout fade-up ${navCollapsed ? 'collapsed' : ''}`}>
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
							onkeydown={handleSideNavKeydown}
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
							onclick={closeMobileNav}
							onkeydown={handleSideNavKeydown}
						>
							<span class="nav-icon">
								{#if isDateIcon(item)}
									<span class="nav-date-icon">{todayDateNumber}</span>
								{:else}
									<i class={`fa-solid ${item.icon}`}></i>
								{/if}
							</span>
							<span class={`text-start nav-item-copy ${navCollapsed ? 'd-none' : ''}`}>
								<span class="d-block fw-semibold">{item.label}</span>
								<span class="soft-text small">{item.description}</span>
							</span>
						</a>
					{/each}
				</div>

				<div class="mt-auto pt-2">
					<a
						class={`nav-item-button ${page.url.pathname === settingsNavItem.href ? 'active' : ''}`}
						href={settingsNavItem.href}
						title={settingsNavItem.label}
						onclick={closeMobileNav}
						onkeydown={handleSideNavKeydown}
					>
						<span class="nav-icon">
							<i class={`fa-solid ${settingsNavItem.icon}`}></i>
						</span>
						<span class={`text-start nav-item-copy ${navCollapsed ? 'd-none' : ''}`}>
							<span class="d-block fw-semibold">{settingsNavItem.label}</span>
							<span class="soft-text small">{settingsNavItem.description}</span>
						</span>
					</a>
				</div>
			</aside>
		{/if}

		<div class={`app-content ${navCollapsed ? 'nav-collapsed' : ''} ${isHomePage ? 'home-shell' : ''}`}>
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

								<div class="d-none d-md-block">
									<GlobalClock />
								</div>
							</div>
						</div>
					</div>
				</section>
			{/if}

			<div class="container-fluid pt-4 pt-lg-4 pb-4 pb-lg-5 px-3 px-lg-4">
				{@render children()}
			</div>
		</div>
	</div>
</div>

{#if !isHomePage}
	<nav class="mobile-bottom-nav glass-panel" aria-label="Mobile navigation">
		{#each [...navItems, settingsNavItem] as item}
			<a
				class={`mobile-bottom-link ${page.url.pathname === item.href ? 'active' : ''}`}
				href={item.href}
				title={item.label}
			>
				{#if isDateIcon(item)}
					<span class="nav-date-icon">{todayDateNumber}</span>
				{:else}
					<i class={`fa-solid ${item.icon}`}></i>
				{/if}
				<span>{item.label}</span>
			</a>
		{/each}
	</nav>
{/if}

{#if !isHomePage && mobileNavOpen}
	<div
		class="pause-modal-backdrop mobile-nav-backdrop"
		role="button"
		tabindex="0"
		aria-label="Close navigation"
		onclick={closeMobileNav}
		onkeydown={(event) => event.target === event.currentTarget && ['Enter', ' ', 'Escape'].includes(event.key) && closeMobileNav()}
	>
		<div
			class="mobile-nav-sheet glass-panel"
			role="dialog"
			aria-modal="true"
			aria-labelledby="mobile-nav-title"
			tabindex="0"
			onclick={(event) => event.stopPropagation()}
			onkeydown={(event) => event.key === 'Escape' && closeMobileNav()}
		>
			<div class="d-flex align-items-center justify-content-between gap-3 mb-4">
				<div>
					<div class="section-label">Navigation</div>
					<div class="mobile-nav-title" id="mobile-nav-title">Karya</div>
				</div>
				<button class="icon-button" type="button" aria-label="Close navigation" onclick={closeMobileNav}>
					<i class="fa-solid fa-xmark"></i>
				</button>
			</div>

			<div class="d-grid gap-2">
				{#each navItems as item}
					<a
						class={`nav-item-button ${page.url.pathname === item.href ? 'active' : ''}`}
						href={item.href}
						title={item.label}
						onclick={closeMobileNav}
					>
						<span class="nav-icon">
							{#if isDateIcon(item)}
								<span class="nav-date-icon">{todayDateNumber}</span>
							{:else}
								<i class={`fa-solid ${item.icon}`}></i>
							{/if}
						</span>
						<span class="text-start">
							<span class="d-block fw-semibold">{item.label}</span>
							<span class="soft-text small">{item.description}</span>
						</span>
					</a>
				{/each}
			</div>

			<div class="mt-4 pt-3 border-top border-light border-opacity-10">
				<a
					class={`nav-item-button ${page.url.pathname === settingsNavItem.href ? 'active' : ''}`}
					href={settingsNavItem.href}
					title={settingsNavItem.label}
					onclick={closeMobileNav}
				>
					<span class="nav-icon">
						<i class={`fa-solid ${settingsNavItem.icon}`}></i>
					</span>
					<span class="text-start">
						<span class="d-block fw-semibold">{settingsNavItem.label}</span>
						<span class="soft-text small">{settingsNavItem.description}</span>
					</span>
				</a>
			</div>
		</div>
	</div>
{/if}

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
