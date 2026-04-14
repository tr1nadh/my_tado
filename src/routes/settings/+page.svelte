<script>
	import { checkForDesktopUpdates, desktopUpdate, isDesktopUpdaterAvailable } from '$lib/desktopUpdater';
	import { settings, todayStarOptions, updateSettings } from '$lib/tasks';

	const desktopUpdatesSupported = isDesktopUpdaterAvailable();

	function clampLimit(value) {
		const parsed = Number.parseInt(value, 10);
		return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
	}
</script>

<section class="glass-panel rounded-4 p-4 fade-up">
	<div class="d-flex flex-column gap-2 mb-4">
		<div class="section-label">Settings</div>
		<h1 class="h4 mb-0">Customize Karya</h1>
		<p class="soft-text mb-0">
			Keep the daily workflow simple or turn on extra planning structure when you want it.
		</p>
	</div>

	<div class="settings-stack">
		<div class="settings-card">
			<div class="d-flex flex-wrap justify-content-between align-items-start gap-3">
				<div class="settings-copy">
					<div class="settings-title">Today stars</div>
					<p class="soft-text mb-2">
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

		{#if desktopUpdatesSupported}
			<div class="settings-card">
				<div class="d-flex flex-wrap justify-content-between align-items-start gap-3">
					<div class="settings-copy">
						<div class="settings-title">Desktop updates</div>
						<p class="soft-text mb-2">
							Check for a newer Windows build and install it from inside Karya when one is available.
						</p>
						{#if $desktopUpdate.currentVersion}
							<div class="soft-text small">
								Current version: <code>{$desktopUpdate.currentVersion}</code>
							</div>
						{/if}
						{#if $desktopUpdate.version}
							<div class="soft-text small">
								Latest found: <code>{$desktopUpdate.version}</code>
							</div>
						{/if}
						{#if $desktopUpdate.status === 'up-to-date'}
							<div class="soft-text small mt-2">You’re up to date.</div>
						{/if}
						{#if $desktopUpdate.lastCheckedAt}
							<div class="soft-text small mt-2">
								Last checked: {new Date($desktopUpdate.lastCheckedAt).toLocaleString('en-IN')}
							</div>
						{/if}
						{#if $desktopUpdate.error}
							<div class="mode-editor-error mt-3">{$desktopUpdate.error}</div>
						{/if}
					</div>
					<button class="toolbar-button active" type="button" onclick={() => checkForDesktopUpdates()} disabled={$desktopUpdate.checking || $desktopUpdate.installing}>
						{$desktopUpdate.checking ? 'Checking…' : 'Check for updates'}
					</button>
				</div>
			</div>
		{/if}
	</div>
</section>
