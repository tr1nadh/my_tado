<script>
	import { addTask } from '$lib/tasks';

	export let activeMode = 'All Modes';

	let draft = '';

	$: currentMode = activeMode === 'All Modes' ? 'Work Sprint' : activeMode;
	$: taskCount = draft
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean).length;

	function submitTasks() {
		const lines = draft
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean);

		if (!lines.length) return;

		for (const title of lines) {
			addTask({
				title,
				mode: currentMode,
				priority: 'Medium',
				energy: 'Quick',
				context: '',
				dueDate: ''
			});
		}

		draft = '';
	}

	function handleKeydown(event) {
		if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
			event.preventDefault();
			submitTasks();
		}
	}
</script>

<section class="glass-panel rounded-4 p-4 fade-up">
	<div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
		<div>
			<div class="section-label">Quick Capture</div>
			<h1 class="h5 mt-2 mb-0">Add Action</h1>
			<p class="soft-text small mt-1 mb-0">One line = one action. Current mode: {currentMode}</p>
		</div>
		<button class="btn btn-brand" type="button" onclick={submitTasks} disabled={!taskCount}>
			<i class="fa-solid fa-plus me-2"></i>Add {taskCount || ''} {taskCount === 1 ? 'action' : 'actions'}
		</button>
	</div>

	<div class="task-capture-shell">
		<textarea
			id="task-title"
			class="form-control task-capture-input"
			bind:value={draft}
			rows="10"
			placeholder={`Finish stand-up notes\nCall bank for KYC update\nPick up medicines on the way home`}
			onkeydown={handleKeydown}
		></textarea>
	</div>

	<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
		<div class="soft-text small">Press `Enter` for a new line. Press `Ctrl/Cmd + Enter` to add all.</div>
		{#if taskCount}
			<div class="badge badge-soft rounded-pill px-3 py-2">{taskCount} ready to add</div>
		{/if}
	</div>
</section>
