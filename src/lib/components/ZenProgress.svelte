<script>
	export let completed = 0;
	export let total = 0;
	export let size = 42;
	export let strokeWidth = 4;
	export let invert = false;

	$: rawRatio = total > 0 ? Math.min(Math.max(completed / total, 0), 1) : 0;
	$: progress = invert ? 1 - rawRatio : rawRatio;
	$: radius = (size - strokeWidth) / 2;
	$: circumference = radius * 2 * Math.PI;
	$: offset = circumference - progress * circumference;

	$: trackColor = 'rgba(252, 211, 77, 0.12)';
	$: remainingColor = 'rgba(245, 158, 11, 0.42)';
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
			stroke={trackColor}
			stroke-width={strokeWidth}
			class="zen-bg-track"
		/>

		<!-- Remaining ring keeps the control visible at 0% -->
		{#if total > 0 && progress < 1}
			<circle
				cx={size / 2}
				cy={size / 2}
				r={radius}
				fill="none"
				stroke={remainingColor}
				stroke-width={strokeWidth}
				stroke-linecap="round"
				transform="rotate(-90 {size / 2} {size / 2})"
				class="zen-remaining-ring"
			/>
		{/if}
		
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
			{displayPercent}<tspan style="font-size: 0.6em; opacity: 0.85; margin-left: 1px;">%</tspan>
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
		opacity: 1;
	}

	.zen-percent-text {
		fill: rgba(236, 244, 255, 0.82);
		font-weight: 600;
		font-family: inherit;
		letter-spacing: -0.02em;
		pointer-events: none;
	}

	.zen-progress-arc {
		/* Clean flat look, no filters */
	}

	.zen-remaining-ring {
		opacity: 0.85;
	}

</style>
