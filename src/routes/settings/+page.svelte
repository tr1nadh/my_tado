<script>
	import { checkForDesktopUpdates, desktopUpdate, isDesktopUpdaterAvailable } from '$lib/desktopUpdater';
	import { 
		activeMode,
		createMode,
		deleteMode,
		getModeIcon,
		modeIcons,
		modes,
		moveModeToIndex,
		renameMode,
		settings, 
		todayStarOptions, 
		updateSettings 
	} from '$lib/tasks';

	const desktopUpdatesSupported = isDesktopUpdaterAvailable();
	const webVersion = __WEB_VERSION__ || 'unknown';
	const desktopDownloadUrl = 'https://github.com/tr1nadh/my_tado/releases/latest';
	const desktopReleasesUrl = 'https://github.com/tr1nadh/my_tado/releases';

	let currentTab = $state('stars'); // 'stars', 'modes', 'about'
	let editingMode = $state(null);
	let editName = $state('');
	let draggedMode = $state(null);
	let modeError = $state('');

	function clampLimit(value) {
		const parsed = Number.parseInt(value, 10);
		return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
	}

	function handleRename() {
		if (renameMode(editingMode, editName)) {
			editingMode = null;
			editName = '';
			modeError = '';
		} else {
			modeError = 'Mode name already exists or is invalid.';
		}
	}

	function handleCreateMode() {
		if (createMode('New Mode')) {
			editingMode = 'New Mode';
			editName = 'New Mode';
		}
	}

	function handleDelete(mode) {
		if (deleteMode(mode)) {
			modeError = '';
		} else {
			modeError = 'Cannot delete the last custom mode.';
		}
	}

	function handleDragStart(event, mode) {
		if (mode === 'All Modes') {
			event.preventDefault();
			return;
		}
		draggedMode = mode;
		event.dataTransfer.effectAllowed = 'move';
		event.dataTransfer.setData('text/plain', mode);
	}

	function handleDragOver(event) {
		event.preventDefault();
		event.dataTransfer.dropEffect = 'move';
	}

	function handleDrop(event, targetMode) {
		event.preventDefault();
		if (!draggedMode || draggedMode === targetMode || targetMode === 'All Modes') return;

		const modeList = $modes;
		const targetIndex = modeList.indexOf(targetMode);
		moveModeToIndex(draggedMode, targetIndex);
		draggedMode = null;
	}
</script>

<section class="glass-panel rounded-4 p-4 fade-up">
	<div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
		<div class="d-flex flex-column gap-2">
			<div class="section-label">Settings</div>
			<h1 class="h4 mb-0">Customize Karya</h1>
			<p class="soft-text mb-0">
				Keep the daily workflow simple or turn on extra planning structure when you want it.
			</p>
		</div>
	</div>

	<!-- Mini Navigation Tabs -->
	<div class="settings-tabs-shell mb-4">
		<div class="settings-tabs">
			<button 
				class="settings-tab {currentTab === 'stars' ? 'active' : ''}" 
				onclick={() => currentTab = 'stars'}
			>
				Priority Stars
			</button>
			<button 
				class="settings-tab {currentTab === 'modes' ? 'active' : ''}" 
				onclick={() => currentTab = 'modes'}
			>
				Modes
			</button>
			<button 
				class="settings-tab {currentTab === 'about' ? 'active' : ''}" 
				onclick={() => currentTab = 'about'}
			>
				About
			</button>
		</div>
	</div>

	<div class="settings-stack">
		{#if currentTab === 'stars'}
			<div class="settings-card fade-up">
				<div class="d-flex flex-wrap justify-content-between align-items-start gap-3">
					<div class="settings-copy">
						<div class="settings-title">Today stars</div>
						<p class="soft-text mb-4">
							Stars work only on the Today page. When one color reaches its limit, the next action you try to place there
							automatically falls through to the next star color, and finally into Remaining.
						</p>

						<div class="today-star-settings-list" aria-label="Today star meanings">
							{#each todayStarOptions as star}
								<div class={`today-star-settings-item ${star.value}`}>
									<span class={`today-star-settings-icon ${star.value}`}>
										<i class={star.value === 'none' || star.value === 'yellow' ? 'fa-regular fa-star' : 'fa-solid fa-star'}></i>
									</span>
									<div class="today-star-settings-copy">
										<div class="today-star-settings-heading">{star.label}</div>
										<div class="soft-text small">{star.meaning}</div>
									</div>
								</div>
							{/each}
						</div>
					</div>

					<div class="settings-number-stack">
						<label class="settings-switch">
							<input
								type="checkbox"
								checked={$settings.useUnifiedTodayStarLimit}
								onchange={(event) => updateSettings({ useUnifiedTodayStarLimit: event.currentTarget.checked })}
							/>
							<span class="settings-switch-track" aria-hidden="true">
								<span class="settings-switch-thumb"></span>
							</span>
							<span>{$settings.useUnifiedTodayStarLimit ? 'Same limit for all stars' : 'Custom limit per star'}</span>
						</label>

						{#if $settings.useUnifiedTodayStarLimit}
							<label class="settings-number-field">
								<span>Limit for each star</span>
								<input
									class="form-control"
									type="number"
									min="1"
									value={$settings.todayStarLimit}
									onchange={(event) => updateSettings({ todayStarLimit: clampLimit(event.currentTarget.value) })}
								/>
							</label>
						{:else}
							<div class="settings-number-grid">
								<label class="settings-number-field">
									<span>Red star limit</span>
									<input
										class="form-control"
										type="number"
										min="1"
										value={$settings.todayStarLimits.red}
										onchange={(event) =>
											updateSettings({
												todayStarLimits: { ...$settings.todayStarLimits, red: clampLimit(event.currentTarget.value) }
											})}
									/>
								</label>
								<label class="settings-number-field">
									<span>Blue star limit</span>
									<input
										class="form-control"
										type="number"
										min="1"
										value={$settings.todayStarLimits.blue}
										onchange={(event) =>
											updateSettings({
												todayStarLimits: { ...$settings.todayStarLimits, blue: clampLimit(event.currentTarget.value) }
											})}
									/>
								</label>
								<label class="settings-number-field">
									<span>Yellow star limit</span>
									<input
										class="form-control"
										type="number"
										min="1"
										value={$settings.todayStarLimits.yellow}
										onchange={(event) =>
											updateSettings({
												todayStarLimits: { ...$settings.todayStarLimits, yellow: clampLimit(event.currentTarget.value) }
											})}
									/>
								</label>
							</div>
						{/if}
					</div>
				</div>
			</div>
		{:else if currentTab === 'modes'}
			<div class="settings-card fade-up">
				<div class="d-flex justify-content-between align-items-center mb-4">
					<div class="settings-copy">
						<div class="settings-title">Task Modes</div>
						<p class="soft-text mb-0">Manage how you group and filter your actions.</p>
					</div>
					<button class="toolbar-button active" type="button" onclick={handleCreateMode}>
						<i class="fa-solid fa-plus me-2"></i>Add Mode
					</button>
				</div>

				<div class="mode-editor-list">
					{#each $modes as mode (mode)}
						<div 
							class="mode-editor-item {draggedMode === mode ? 'dragging' : ''}"
							draggable={mode !== 'All Modes'}
							ondragstart={(e) => handleDragStart(e, mode)}
							ondragover={handleDragOver}
							ondrop={(e) => handleDrop(e, mode)}
						>
							<div class="d-flex align-items-center gap-3 flex-grow-1">
								{#if mode !== 'All Modes'}
									<div class="mode-drag-handle text-muted">
										<i class="fa-solid fa-grip-vertical"></i>
									</div>
								{:else}
									<div style="width: 14px;"></div>
								{/if}

								<div class="d-flex align-items-center justify-content-center" style="width: 24px; height: 24px;">
									<i class="fa-solid {getModeIcon(mode, $modeIcons)} soft-text" style="font-size: 0.9rem;"></i>
								</div>

								{#if editingMode === mode}
									<input
										class="form-control form-control-sm flex-grow-1"
										type="text"
										bind:value={editName}
										onkeydown={(e) => e.key === 'Enter' && handleRename()}
										autoFocus
									/>
								{:else}
									<span class="mode-name flex-grow-1">{mode}</span>
								{/if}
							</div>

							<div class="d-flex gap-2">
								{#if editingMode === mode}
									<button class="icon-button text-success" type="button" onclick={handleRename} title="Save rename">
										<i class="fa-solid fa-check"></i>
									</button>
									<button class="icon-button text-muted" type="button" onclick={() => (editingMode = null)} title="Cancel">
										<i class="fa-solid fa-xmark"></i>
									</button>
								{:else if mode !== 'All Modes'}
									<button class="icon-button text-muted" type="button" onclick={() => { editingMode = mode; editName = mode; }} title="Rename">
										<i class="fa-solid fa-pen"></i>
									</button>
									<button class="icon-button text-danger" type="button" onclick={() => handleDelete(mode)} title="Delete">
										<i class="fa-solid fa-trash-can"></i>
									</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>

				{#if modeError}
					<div class="mode-editor-error mt-3">{modeError}</div>
				{/if}
			</div>
		{:else if currentTab === 'about'}
			<div class="settings-card fade-up about-karya-stack">
				<div class="settings-title mb-3">About Karya</div>

				<div class="settings-copy about-karya-card about-karya-intro mb-3">
					<div class="settings-row-title mb-2">What is Karya?</div>
					<p class="soft-text mb-2">
						Karya is a mode-based action planner built for fast, high-context daily work. It keeps capture, planning,
						and execution in one focused flow across Today, All, and Upcoming.
					</p>
					<p class="soft-text small mb-0">
						Designed for people who switch contexts often and want lightweight structure without heavy project-management overhead.
					</p>
				</div>

				<div class="settings-group about-karya-card">
					<div class="d-flex flex-wrap justify-content-between align-items-start gap-3">
						<div class="settings-copy about-karya-copy">
							<div class="settings-row-title mb-2">Web version</div>
							<p class="soft-text small mb-0">
								Latest web build currently running in this app session.
							</p>
						</div>
						<div class="d-flex flex-column align-items-end gap-1">
							<div class="soft-text small">Version</div>
							<div><code>v{webVersion}</code></div>
						</div>
					</div>
				</div>

				{#if desktopUpdatesSupported}
					<div class="settings-group about-karya-card">
						<div class="d-flex flex-wrap justify-content-between align-items-start gap-4">
							<div class="settings-copy about-karya-copy">
								<div class="settings-row-title mb-2">Desktop app installed</div>
								<p class="soft-text small mb-0">
									Check for a newer Windows build and install it from inside Karya when one is available.
								</p>
							</div>
							<div class="d-flex flex-column align-items-end gap-3">
								<button class="toolbar-button active" type="button" onclick={() => checkForDesktopUpdates()} disabled={$desktopUpdate.checking || $desktopUpdate.installing}>
									{$desktopUpdate.checking ? 'Checking…' : 'Check for updates'}
								</button>
								
								{#if $desktopUpdate.currentVersion || $desktopUpdate.version}
									<div class="d-flex flex-column align-items-end gap-1">
										{#if $desktopUpdate.currentVersion}
											<div class="soft-text x-small">Current: <code>{$desktopUpdate.currentVersion}</code></div>
										{/if}
										{#if $desktopUpdate.version}
											<div class="soft-text x-small">Latest: <code>{$desktopUpdate.version}</code></div>
										{/if}
									</div>
								{/if}

								{#if $desktopUpdate.status === 'up-to-date'}
									<div class="text-success small"><i class="fa-solid fa-circle-check me-2"></i>You’re up to date.</div>
								{/if}

								{#if $desktopUpdate.lastCheckedAt}
									<div class="soft-text x-small">Last checked: {new Date($desktopUpdate.lastCheckedAt).toLocaleString('en-IN')}</div>
								{/if}

								{#if $desktopUpdate.error}
									<div class="text-danger small mt-2">{$desktopUpdate.error}</div>
								{/if}
							</div>
						</div>
					</div>
				{:else}
					<div class="settings-group about-karya-card">
						<div class="d-flex flex-wrap justify-content-between align-items-start gap-4">
							<div class="settings-copy about-karya-copy">
								<div class="settings-row-title mb-2">Desktop app not detected</div>
								<p class="soft-text small mb-0">
									Install Karya Desktop for native updates and a dedicated app experience.
								</p>
							</div>
							<div class="d-flex flex-column align-items-end gap-2">
								<a
									class="toolbar-button active text-decoration-none"
									href={desktopDownloadUrl}
									target="_blank"
									rel="noopener noreferrer"
								>
									Download for Desktop
								</a>
								<a
									class="soft-text small text-decoration-none"
									href={desktopReleasesUrl}
									target="_blank"
									rel="noopener noreferrer"
								>
									View GitHub releases
								</a>
							</div>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</section>
