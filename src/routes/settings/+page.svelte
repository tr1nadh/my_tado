<script>
	import { checkForDesktopUpdates, desktopUpdate, isDesktopUpdaterAvailable } from '$lib/desktopUpdater';
	import { settings, updateSettings } from '$lib/tasks';

	const desktopUpdatesSupported = isDesktopUpdaterAvailable();
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
					<div class="settings-title">Action categories</div>
					<p class="soft-text mb-2">
						Show or hide the four planning categories on the Today page. New actions still default to
						<code>Not urgent and not important</code>.
					</p>
				</div>
				<label class="settings-switch">
					<input
						type="checkbox"
						checked={$settings.enableMatrixCategories}
						onchange={(event) => updateSettings({ enableMatrixCategories: event.currentTarget.checked })}
					/>
					<span class="settings-switch-track" aria-hidden="true">
						<span class="settings-switch-thumb"></span>
					</span>
					<span>{ $settings.enableMatrixCategories ? 'Enabled' : 'Disabled' }</span>
				</label>
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
