<script>
	import { goto } from '$app/navigation';
	import { activeMode, getModeIcon, modeColorMap, modeIcons, modes, updateSettings, settings } from '$lib/tasks';
	import { toast } from '$lib/toast';
	import GlobalClock from './GlobalClock.svelte';

	let { activeModeTimeBlock = null, activeModeTimeBlockProgress = 0 } = $props();

	let modeDropdownOpen = $state(false);
	let modeDropdownTimer;

	function openModeDropdown() {
		if (modeDropdownTimer) clearTimeout(modeDropdownTimer);
		modeDropdownOpen = true;
	}

	function closeModeDropdownSoon() {
		if (modeDropdownTimer) clearTimeout(modeDropdownTimer);
		modeDropdownTimer = setTimeout(() => {
			modeDropdownOpen = false;
		}, 180);
	}

	function formatTimeLabel(timeStr) {
		if (!timeStr) return '';
		const [h, m] = timeStr.split(':');
		const hour = parseInt(h);
		const ampm = hour >= 12 ? 'PM' : 'AM';
		const displayHour = hour % 12 || 12;
		return `${displayHour}:${m}${ampm}`;
	}
</script>

<div class="subtle-header-row">
	<div
		class="today-subtle-selector-shell {modeDropdownOpen ? 'open' : ''}"
		role="presentation"
		onmouseenter={openModeDropdown}
		onmouseleave={closeModeDropdownSoon}
	>
		<button 
			class="today-subtle-mode-display {activeModeTimeBlock ? 'active' : ''}" 
			type="button"
			aria-expanded={modeDropdownOpen}
			style={activeModeTimeBlock ? `--mode-color: ${modeColorMap[activeModeTimeBlock.mode] || modeColorMap.Default};` : ''}
			onclick={() => (modeDropdownOpen = !modeDropdownOpen)}
		>
			<div class="today-subtle-mode-icon-shell">
				<i class="fa-solid {getModeIcon($activeMode, $modeIcons)}" style="font-size: 0.9em;"></i>
				{#if activeModeTimeBlock}
					<span class="today-subtle-mode-pulse"></span>
				{/if}
			</div>
			<span class="today-subtle-mode-label">{$activeMode}</span>
			
			{#if activeModeTimeBlock}
				<span class="today-subtle-mode-time">
					({formatTimeLabel(activeModeTimeBlock.startTime)} - {formatTimeLabel(activeModeTimeBlock.endTime)})
				</span>
				<div class="today-subtle-mode-progress">
					<div class="today-subtle-mode-progress-fill" style={`width: ${activeModeTimeBlockProgress}%;`}></div>
				</div>
			{/if}
			
			<i class="fa-solid fa-chevron-down ms-1" style="font-size: 0.75em; opacity: 0.6; margin-top: 2px;"></i>
		</button>

		<div
			class="today-subtle-modes-dropdown {$settings.modeTimeBlocksEnabled ? 'locked' : ''}"
			role="presentation"
			onmouseenter={openModeDropdown}
			onmouseleave={closeModeDropdownSoon}
		>
			{#each $modes.filter(m => m !== $activeMode) as mode}
				<button 
					class="mode-pill" 
					onclick={() => { 
						if ($settings.modeTimeBlocksEnabled) {
							toast.show('Mode selection is locked by Auto schedule', 'lock');
							return;
						}
						activeMode.set(mode);
						updateSettings({ modeTimeBlocksEnabled: false });
						modeDropdownOpen = false;
					}}
					style="padding: 0.4rem 0.85rem;"
				>
					<i class="fa-solid {getModeIcon(mode, $modeIcons)}" style="font-size: 0.8rem; opacity: 0.7;"></i>
					<span class="mode-pill-label" style="font-size: 0.8rem;">{mode}</span>
					{#if $settings.modeTimeBlocksEnabled}
						<i class="fa-solid fa-lock ms-auto" style="font-size: 0.65rem; opacity: 0.3;"></i>
					{/if}
				</button>
			{/each}
		</div>
	</div>

	<div class="subtle-header-clock-actions d-flex align-items-center gap-2 gap-md-3">
		{#if $settings.modeTimeBlocksEnabled}
			<div class="d-none d-md-block">
				<GlobalClock />
			</div>
		{/if}
		<details class="today-settings-menu">
			<summary class="icon-button subtle-header-settings subtle-header-profile" aria-label="Profile menu">
				<i class="fa-solid fa-circle-user" aria-hidden="true"></i>
				<span class="subtle-header-profile-label">Guest</span>
			</summary>
			<div class="today-settings-dropdown">
				<a href="/settings" class="today-settings-item">
					<i class="fa-solid fa-sliders"></i>
					<span>Settings</span>
				</a>
				<button class="today-settings-item logout" type="button" onclick={() => goto('/')}>
					<i class="fa-solid fa-right-from-bracket"></i>
					<span>Logout</span>
				</button>
			</div>
		</details>
	</div>
</div>

<style>
	.subtle-header-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0;
		width: 100%;
	}

	.today-subtle-selector-shell {
		position: relative;
		z-index: 101;
	}

	.today-subtle-selector-shell::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		top: 100%;
		height: 0.5rem;
	}

	.today-subtle-mode-display {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem 0.9rem;
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 0.85rem;
		color: var(--text);
		font-size: 0.9rem;
		font-weight: 500;
		transition: all 0.2s ease;
		position: relative;
		overflow: hidden;
	}

	.today-subtle-mode-display:hover {
		background: var(--panel-strong);
		border-color: var(--line-strong);
	}

	.today-subtle-mode-display.active {
		border-color: var(--line-strong);
	}

	/* Keep trigger visible even while dropdown is open. */
	.today-subtle-selector-shell.open .today-subtle-mode-display {
		opacity: 1;
		transform: none;
		pointer-events: auto;
	}

	.today-subtle-mode-display.active .today-subtle-mode-label {
		color: var(--mode-color);
		font-weight: 600;
	}

	.today-subtle-mode-icon-shell {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.today-subtle-mode-pulse {
		position: absolute;
		top: -2px;
		right: -2px;
		width: 6px;
		height: 6px;
		background: var(--mode-color);
		border-radius: 50%;
		box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.25);
		animation: mode-pulse 2s infinite;
	}

	@keyframes mode-pulse {
		0% { transform: scale(0.95); opacity: 0.8; }
		50% { transform: scale(1.2); opacity: 1; }
		100% { transform: scale(0.95); opacity: 0.8; }
	}

	.today-subtle-mode-time {
		font-size: 0.75rem;
		opacity: 0.5;
		font-weight: 400;
		margin-left: -0.2rem;
	}

	.today-subtle-mode-progress {
		position: absolute;
		bottom: 0;
		left: 0;
		width: 100%;
		height: 2px;
		background: rgba(255, 255, 255, 0.04);
	}

	.today-subtle-mode-progress-fill {
		height: 100%;
		background: var(--mode-color);
		transition: width 0.5s ease-out;
	}

	.today-subtle-modes-dropdown {
		position: absolute;
		top: calc(100% + 0.1rem);
		left: 0;
		min-width: 180px;
		background: var(--panel-solid);
		border: 1px solid var(--line-strong);
		border-radius: 1rem;
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 2px;
		box-shadow: var(--shadow-soft);
		opacity: 0;
		visibility: hidden;
		transform: translateY(-8px);
		transition: all 0.2s ease;
	}

	.today-subtle-selector-shell.open .today-subtle-modes-dropdown {
		opacity: 1;
		visibility: visible;
		transform: translateY(0);
	}

	.today-subtle-modes-dropdown.locked .mode-pill {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.mode-pill {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.6rem 0.85rem;
		border-radius: 0.65rem;
		color: var(--muted);
		transition: all 0.2s ease;
		background: transparent;
		border: none;
		text-align: left;
	}

	.today-subtle-modes-dropdown:not(.locked) .mode-pill:hover {
		background: rgba(79, 70, 229, 0.16);
		color: var(--text);
	}

	.mode-pill-label {
		font-size: 0.85rem;
		font-weight: 500;
	}

	.subtle-header-clock-actions {
		flex-shrink: 0;
		align-items: center;
	}

	.subtle-header-settings {
		width: auto;
		height: auto;
		padding: 0.35rem 0.6rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		border-radius: 999px;
		opacity: 0.65;
		transition: opacity 0.2s ease;
	}

	.subtle-header-settings:hover {
		opacity: 1;
	}

	.subtle-header-profile i {
		font-size: 1.15rem;
	}

	.subtle-header-profile-label {
		font-size: 0.82rem;
		font-weight: 750;
		color: rgba(234, 242, 255, 0.86);
		letter-spacing: 0.01em;
	}

	.today-settings-menu {
		position: relative;
	}

	.today-settings-menu > summary {
		list-style: none;
	}

	.today-settings-menu > summary::-webkit-details-marker {
		display: none;
	}

	.today-settings-dropdown {
		position: absolute;
		top: calc(100% + 0.35rem);
		right: 0;
		min-width: 10.5rem;
		padding: 0.35rem;
		border-radius: 10px;
		border: 1px solid var(--line-strong);
		background: var(--panel-solid);
		box-shadow: var(--shadow-soft);
		z-index: 30;
		display: grid;
		gap: 0.2rem;
	}

	.today-settings-item {
		width: 100%;
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.5rem 0.6rem;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: rgba(234, 242, 255, 0.92);
		font-size: 0.83rem;
		font-weight: 600;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
		transition: background 0.2s ease, color 0.2s ease;
	}

	.today-settings-item:hover {
		background: rgba(79, 70, 229, 0.16);
		color: var(--text);
	}

	.today-settings-item.logout {
		color: rgba(255, 77, 109, 0.9);
	}

	.today-settings-item.logout:hover {
		background: rgba(255, 77, 109, 0.14);
		color: rgba(255, 190, 200, 0.96);
	}
</style>
