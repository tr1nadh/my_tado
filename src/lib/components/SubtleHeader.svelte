<script>
	import { goto } from '$app/navigation';
	import { activeMode, getModeIcon, modeColorMap, modeIcons, modes, updateSettings, settings } from '$lib/tasks';
	import { toast } from '$lib/toast';
	import GlobalClock from './GlobalClock.svelte';

	let { activeModeTimeBlock = null, activeModeTimeBlockProgress = 0 } = $props();

	let modeDropdownOpen = $state(false);
	let modeDropdownTimer;

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
		onmouseenter={() => { 
			if (modeDropdownTimer) clearTimeout(modeDropdownTimer); 
		}}
		onmouseleave={() => { 
			modeDropdownTimer = setTimeout(() => modeDropdownOpen = false, 300); 
		}}
	>
		<button 
			class="today-subtle-mode-display {activeModeTimeBlock ? 'active' : ''}" 
			type="button"
			style={activeModeTimeBlock ? `--mode-color: ${modeColorMap[activeModeTimeBlock.mode] || modeColorMap.Default};` : ''}
			onmouseenter={() => (modeDropdownOpen = true)}
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

		<div class="today-subtle-modes-dropdown {$settings.modeTimeBlocksEnabled ? 'locked' : ''}">
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
		<GlobalClock />
		<details class="today-settings-menu">
			<summary class="icon-button subtle-header-settings" aria-label="Settings menu">
				<i class="fa-solid fa-gear" style="font-size: 1.1rem;"></i>
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

	.today-subtle-mode-display {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem 0.9rem;
		background: rgba(10, 25, 45, 0.35);
		backdrop-filter: blur(8px);
		border: 1px solid rgba(255, 255, 255, 0.05);
		border-radius: 0.85rem;
		color: #fff;
		font-size: 0.9rem;
		font-weight: 500;
		transition: all 0.2s ease;
		position: relative;
		overflow: hidden;
	}

	.today-subtle-mode-display:hover {
		background: rgba(10, 25, 45, 0.5);
		border-color: rgba(255, 255, 255, 0.1);
	}

	.today-subtle-mode-display.active {
		border-color: rgba(255, 255, 255, 0.15);
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
		box-shadow: 0 0 8px var(--mode-color);
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
		background: rgba(255, 255, 255, 0.05);
	}

	.today-subtle-mode-progress-fill {
		height: 100%;
		background: var(--mode-color);
		transition: width 0.5s ease-out;
	}

	.today-subtle-modes-dropdown {
		position: absolute;
		top: calc(100% + 0.5rem);
		left: 0;
		min-width: 180px;
		background: rgba(15, 30, 55, 0.95);
		backdrop-filter: blur(16px);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 1rem;
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 2px;
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
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
		color: rgba(255, 255, 255, 0.7);
		transition: all 0.2s ease;
		background: transparent;
		border: none;
		text-align: left;
	}

	.mode-pill:hover:not(.locked .mode-pill) {
		background: rgba(255, 255, 255, 0.06);
		color: #fff;
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
		width: 2rem;
		height: 2rem;
		opacity: 0.65;
		transition: opacity 0.2s ease;
	}

	.subtle-header-settings:hover {
		opacity: 1;
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
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(11, 16, 24, 0.96);
		backdrop-filter: blur(10px);
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
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
		color: #dbe6f4;
		font-size: 0.83rem;
		font-weight: 600;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
		transition: background 0.2s ease, color 0.2s ease;
	}

	.today-settings-item:hover {
		background: rgba(255, 255, 255, 0.12);
		color: #ffffff;
	}

	.today-settings-item.logout {
		color: #ffb5bf;
	}

	.today-settings-item.logout:hover {
		background: rgba(255, 107, 129, 0.16);
		color: #ffc8cf;
	}
</style>
