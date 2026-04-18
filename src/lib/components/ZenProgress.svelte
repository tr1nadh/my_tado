<script>
	export let completed = 0;
	export let total = 0;
	export let size = 42;
	export let strokeWidth = 4;

	$: progress = total > 0 ? Math.min(Math.max(completed / total, 0), 1) : 0;
	$: radius = (size - strokeWidth) / 2;
	$: circumference = radius * 2 * Math.PI;
	$: offset = circumference - progress * circumference;

	// Premium Emerald color
	$: color = progress >= 1 ? '#10b981' : '#34d399';
	
	$: displayPercent = Math.round(progress * 100);
</script>

<div class="zen-progress-shell" style="width: {size}px; height: {size}px;">
	<svg width={size} height={size} viewBox="0 0 {size} {size}" class="zen-progress-svg">
		<!-- Background Track -->
		<circle
			cx={size / 2}
			cy={size / 2}
			r={radius}
			fill="none"
			stroke="currentColor"
			stroke-width={strokeWidth}
			class="zen-bg-track"
		/>
		
		<!-- Progress Arc -->
		{#if progress > 0}
			<circle
				cx={size / 2}
				cy={size / 2}
				r={radius}
				fill="none"
				stroke={color}
				stroke-width={strokeWidth}
				stroke-dasharray="{circumference} {circumference}"
				style="stroke-dashoffset: {offset}; transition: stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.6s ease;"
				stroke-linecap="round"
				transform="rotate(-90 {size / 2} {size / 2})"
				class="zen-progress-arc"
			/>
		{/if}

		<!-- Center Text -->
		<text
			x="50%"
			y="50%"
			dy="0.32em"
			text-anchor="middle"
			class="zen-percent-text"
			style="font-size: {size * 0.28}px;"
		>
			{displayPercent}<tspan style="font-size: 0.6em; opacity: 0.8; margin-left: 1px;">%</tspan>
		</text>
	</svg>
</div>

<style>
	.zen-progress-shell {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		vertical-align: middle;
		flex-shrink: 0;
	}

	.zen-progress-svg {
		display: block;
	}

	.zen-bg-track {
		opacity: 0.15;
		color: var(--text-muted, rgba(129, 181, 255, 0.2));
	}

	.zen-percent-text {
		fill: currentColor;
		opacity: 0.7;
		font-weight: 600;
		font-family: inherit;
		letter-spacing: -0.02em;
		pointer-events: none;
	}

	.zen-progress-arc {
		/* Clean flat look, no filters */
	}
</style>
