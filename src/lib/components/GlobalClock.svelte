<script>
	import { onMount } from 'svelte';

	let currentTime = $state(new Date());

	onMount(() => {
		const interval = setInterval(() => {
			currentTime = new Date();
		}, 1000);
		return () => clearInterval(interval);
	});
</script>

<div class="today-top-clock-shell">
	<div class="today-top-clock">
		<span class="clock-time">
			{currentTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).split(' ')[0]}
		</span>
		<div class="clock-meta">
			<span class="clock-ampm">
				{currentTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).split(' ')[1]}
			</span>
			<span class="clock-seconds">
				{currentTime.getSeconds().toString().padStart(2, '0')}
			</span>
		</div>
	</div>
</div>

<style>
	.today-top-clock-shell {
		pointer-events: none;
	}

	.today-top-clock {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.45rem 0.9rem;
		background: rgba(10, 25, 45, 0.4);
		backdrop-filter: blur(12px);
		border: 1px solid rgba(255, 255, 255, 0.04);
		border-radius: 1rem;
		color: #fff;
		font-family: 'Inter', system-ui, sans-serif;
		pointer-events: auto;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
	}

	.today-top-clock:hover {
		background: rgba(15, 35, 60, 0.6);
		transform: translateY(-1px);
		border-color: rgba(255, 255, 255, 0.08);
		box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18);
	}

	.clock-time {
		font-size: 1.25rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		line-height: 1;
	}

	.clock-meta {
		display: flex;
		flex-direction: column;
		line-height: 1;
		gap: 2px;
	}

	.clock-ampm {
		font-size: 0.65rem;
		font-weight: 800;
		text-transform: uppercase;
		opacity: 0.8;
		letter-spacing: 0.05em;
		color: var(--blue, #3b82f6);
	}

	.clock-seconds {
		font-size: 0.65rem;
		font-weight: 600;
		opacity: 0.35;
		font-variant-numeric: tabular-nums;
	}
</style>
