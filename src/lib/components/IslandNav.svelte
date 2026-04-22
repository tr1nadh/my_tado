<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { getActiveModeTimeBlock, settings, settingsReady } from '$lib/tasks';
	import { toast } from '$lib/toast';

	const tabs = ['All', 'Today', 'Upcoming'];

	function getActiveKey(currentPage) {
		const path = currentPage.url.pathname;
		if (path === '/today' || path.startsWith('/today/')) {
			const tab = currentPage.url.searchParams.get('tab');
			return tabs.includes(tab) ? tab : 'Today';
		}
		if (path === '/upcoming') return 'Upcoming';
		if (path === '/inbox') return 'All';
		return null;
	}

	function isScheduleLocked() {
		if (!$settingsReady) return false;
		return getActiveModeTimeBlock($settings, new Date()) !== null;
	}

	function navTo(key) {
		if (!key) return;

		// When a mode time block is active, keep users on Today only.
		if (key !== 'Today' && isScheduleLocked()) {
			toast.show('Auto schedule is active. Stay on Today until your current block ends.', 'lock');
			goto('/today?tab=Today', { replaceState: true, keepFocus: true, noScroll: true });
			return;
		}

		if (tabs.includes(key)) {
			goto(`/today?tab=${encodeURIComponent(key)}`, { keepFocus: true, noScroll: true });
		}
	}

	// Important: make this reactive to the $page store. If we read $page only
	// inside helper functions, Svelte won't automatically re-run this when the
	// URL changes.
	$: activeKey = getActiveKey($page);
</script>

<nav class="dynamic-island-nav" aria-label="Primary">
	<button
		type="button"
		class={`island-tab ${activeKey === 'All' ? 'active' : ''}`}
		aria-current={activeKey === 'All' ? 'page' : undefined}
		onclick={() => navTo('All')}
	>
		<i class="fa-solid fa-layer-group island-icon" aria-hidden="true"></i>
		<span class="island-label">All</span>
	</button>

	<button
		type="button"
		class={`island-tab ${activeKey === 'Today' ? 'active' : ''}`}
		aria-current={activeKey === 'Today' ? 'page' : undefined}
		onclick={() => navTo('Today')}
	>
		<i class="fa-solid fa-sun island-icon" aria-hidden="true"></i>
		<span class="island-label">Today</span>
	</button>

	<button
		type="button"
		class={`island-tab ${activeKey === 'Upcoming' ? 'active' : ''}`}
		aria-current={activeKey === 'Upcoming' ? 'page' : undefined}
		onclick={() => navTo('Upcoming')}
	>
		<i class="fa-solid fa-calendar-days island-icon" aria-hidden="true"></i>
		<span class="island-label">Upcoming</span>
	</button>
</nav>

<style>
	.dynamic-island-nav {
		position: fixed;
		left: 50%;
		bottom: max(0.85rem, calc(0.6rem + env(safe-area-inset-bottom, 0px)));
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		width: min(34rem, calc(100vw - 1.1rem));
		padding: 0.5rem 0.64rem;
		gap: 0.36rem;
		background: var(--panel-solid);
		border-radius: 999px;
		border: 1px solid var(--line-strong);
		box-shadow:
			0 14px 30px rgba(0, 0, 0, 0.33),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
		z-index: 1025;
		overflow: hidden;
	}

	.island-tab {
		position: relative;
		flex: 1 1 0;
		min-width: 0;
		border: 1px solid transparent;
		background: transparent;
		color: var(--muted);
		padding: 0.66rem 0.7rem;
		border-radius: 0.9rem;
		font-weight: 700;
		font-size: 0.8rem;
		cursor: pointer;
		transition:
			transform 0.2s ease,
			background 0.2s ease,
			border-color 0.2s ease,
			color 0.2s ease,
			box-shadow 0.2s ease;
		display: flex;
		flex-direction: row;
		gap: 0.5rem;
		align-items: center;
		justify-content: center;
		white-space: nowrap;
	}

	.island-tab::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: rgba(255, 255, 255, 0.04);
		opacity: 0;
		transition: opacity 0.2s ease;
		pointer-events: none;
	}

	.island-icon {
		font-size: 0.74rem;
		opacity: 0.9;
	}

	.island-tab:hover:not(:disabled) {
		color: var(--text);
		background: rgba(79, 70, 229, 0.14);
		border-color: var(--line-strong);
		transform: translateY(-1px);
	}

	.island-tab.active {
		color: var(--text);
		background:
			linear-gradient(145deg, rgba(79, 70, 229, 0.32), rgba(67, 56, 202, 0.18)),
			rgba(79, 70, 229, 0.16);
		border-color: rgba(245, 158, 11, 0.42);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.16),
			0 6px 14px rgba(17, 24, 39, 0.3);
	}

	.island-tab:hover:not(:disabled)::before,
	.island-tab.active::before {
		opacity: 1;
	}

	.island-tab:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	/* Desktop: keep it compact so it feels like a "switcher", not a bottom bar. */
	@media (min-width: 1200px) {
		.dynamic-island-nav {
			width: min(clamp(26rem, 36vw, 38rem), calc(100vw - 2rem));
			padding: 0.36rem 0.58rem;
			gap: 0.3rem;
			bottom: 0.7rem;
		}

		.island-tab {
			padding: 0.58rem 0.75rem;
			font-size: 0.79rem;
		}
	}

	/* Very small: icon-only is less cramped. */
	@media (max-width: 460px) {
		.dynamic-island-nav {
			width: calc(100vw - 0.75rem);
			padding: 0.34rem 0.36rem;
			gap: 0.22rem;
		}

		.island-tab {
			padding: 0.55rem 0.4rem;
		}

		.island-label {
			display: none;
		}

		.island-icon {
			font-size: 0.9rem;
		}
	}
</style>
