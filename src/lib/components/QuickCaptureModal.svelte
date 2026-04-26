<script>
	import { getModeIcon } from '$lib/tasks';

	export let open = false;
	export let close = () => {};
	export let submit = () => {};
	export let draft = '';
	export let highlightHtml = '';
	export let actionCount = 0;
	export let activeMode = 'All Modes';
	export let modeColorMap = {};
	export let modeIcons = {};
	export let inputRef = null;
	export let onInput = () => {};
	export let onKeydown = () => {};
	export let ariaLabelledBy = 'add-action-title';

	$: currentMode = activeMode === 'All Modes' ? 'Work Sprint' : activeMode;
</script>

{#if open}
	<div
		class="pause-modal-backdrop"
		role="button"
		tabindex="0"
		aria-label="Close add action modal"
		onclick={close}
		onkeydown={(event) => event.target === event.currentTarget && ['Enter', ' ', 'Escape'].includes(event.key) && close()}
	>
		<div
			class="pause-modal action-capture-modal"
			role="dialog"
			aria-modal="true"
			aria-labelledby={ariaLabelledBy}
			tabindex="0"
			onclick={(event) => event.stopPropagation()}
			onkeydown={(event) => event.key === 'Escape' && close()}
		>
			<div class="d-flex justify-content-between align-items-start gap-3 mb-3">
				<div>
					<div class="section-label">Quick Capture</div>
					<div class="d-flex align-items-center gap-2 mt-2">
						{#if activeMode !== 'All Modes'}
							<div class="active-mode-badge" style={`background: ${modeColorMap[activeMode] || modeColorMap.Default}; padding: 0.2rem 0.6rem; font-size: 0.75rem;`}>
								<i class="fa-solid {getModeIcon(activeMode, modeIcons)}"></i>
								{activeMode}
							</div>
						{/if}
						<h2 class="h6 mb-0" id={ariaLabelledBy}>Add Actions</h2>
					</div>
					<p class="soft-text small mb-0 mt-1">One line per action. The current mode will be used automatically.</p>
				</div>
				<button class="icon-button" type="button" aria-label="Close add action modal" onclick={close}>
					<i class="fa-solid fa-xmark"></i>
				</button>
			</div>

			<div class="task-capture-shell">
				<div class="task-capture-highlight" aria-hidden="true">
					<div class="task-capture-highlight-copy">
						{@html highlightHtml}
					</div>
				</div>
				<textarea
					bind:this={inputRef}
					class="form-control task-capture-input"
					bind:value={draft}
					rows="10"
					placeholder={`Finish stand-up notes\nCall bank for KYC update\nPick up medicines on the way home`}
					oninput={onInput}
					onkeydown={onKeydown}
				></textarea>
			</div>

			<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
				<div class="soft-text small">Press `Enter` for a new line. Press `Ctrl/Cmd + Enter` to add all.</div>
				{#if actionCount}
					<div class="badge badge-soft rounded-pill px-3 py-2">{actionCount} ready to add</div>
				{/if}
			</div>

			<div class="d-flex justify-content-end gap-2 mt-3">
				<button class="toolbar-button" type="button" onclick={close}>Cancel</button>
				<button class="toolbar-button active" type="button" onclick={submit} disabled={!actionCount}>
					Add {actionCount || ''} {actionCount === 1 ? 'Action' : 'Actions'}
				</button>
			</div>
		</div>
	</div>
{/if}
