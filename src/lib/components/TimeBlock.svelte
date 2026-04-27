<script>
	export let block;
	export let selectedBlockId;
	export let timeBlockDragState;
	export let formatTimeLabel;
	export let startTimeBlockDrag;
	export let handleBlockClick;
	export let removeModeTimeBlock;
	export let startTimeBlockResize;
</script>

<div
	class={`today-time-block ${block.active ? 'active' : ''} ${selectedBlockId === block.id ? 'selected' : ''} ${block.collision ? 'collision' : ''} ${timeBlockDragState?.blockId === block.id ? 'dragging' : ''}`}
	style={`top:${block.top}%; height:${block.height}%; cursor: ${timeBlockDragState?.blockId === block.id ? 'grabbing' : 'grab'}; --block-color: ${block.color};`}
	onpointerdown={(event) => startTimeBlockDrag(event, block)}
	onclick={(event) => handleBlockClick(event, block.id)}
	role="button"
	tabindex="0"
	onkeydown={(e) => e.key === 'Enter' && handleBlockClick(e, block.id)}
>
	{#if selectedBlockId === block.id}
		<button
			class="today-time-block-delete"
			type="button"
			title="Delete block"
			onclick={(e) => { e.stopPropagation(); removeModeTimeBlock(block.id); }}
		>
			<i class="fa-solid fa-trash-can"></i>
		</button>
	{/if}

	<button
		class="today-time-block-handle top"
		type="button"
		aria-label={`Resize ${block.mode} block start`}
		onpointerdown={(event) => startTimeBlockResize(event, block, 'start')}
	></button>

	<div class="today-time-block-mode">
		{block.mode} 
		<span class="ms-1 opacity-50 pe-none" style="font-size: 0.75em;">({block.durationDisplay})</span>
	</div>

	<div class="today-time-block-range">
		{formatTimeLabel(block.startTime)} to {formatTimeLabel(block.endTime)}
	</div>

	{#if block.active}
		<div class="today-time-block-progress" style={`width: ${block.progress}%;`}></div>
	{/if}

	<button
		class="today-time-block-handle bottom"
		type="button"
		aria-label={`Resize ${block.mode} block end`}
		onpointerdown={(event) => startTimeBlockResize(event, block, 'end')}
	></button>
</div>

