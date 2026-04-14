<script>
	const painPoints = [
		'Too many tasks competing for attention.',
		'Important work buried under backlog noise.',
		'No clear next move when the day gets messy.'
	];

	const solutionSteps = [
		{
			label: 'Capture',
			copy: 'Keep every action in one place instead of juggling it in your head.'
		},
		{
			label: 'Reduce',
			copy: 'Let Today surface only what deserves attention right now.'
		},
		{
			label: 'Move',
			copy: 'Start with one clear next step and build momentum from there.'
		}
	];
</script>

<section class="home-page home-page-simple fade-up">
	<div class="home-hero home-hero-simple glass-panel">
		<div class="home-problem-grid">
			<div class="home-hero-copy">
				<div class="section-label">Karya</div>
				<h1>When everything feels important, the real problem is deciding what to do now.</h1>
				<p class="soft-text">
					Karya helps you cut through the noise, narrow the day down, and act on what matters instead of scanning an endless list.
				</p>

				<div class="home-cta-row">
					<a class="btn btn-brand" href="/today">Take action</a>
					<a class="home-secondary-link" href="/inbox">Review all actions</a>
				</div>
			</div>

			<div class="home-problem-panel">
				<div class="section-label">The problem</div>
				<div class="home-problem-list">
					{#each painPoints as item}
						<div class="home-problem-item">
							<span></span>
							<p>{item}</p>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</div>

	<section class="home-section home-section-simple">
		<div class="home-section-heading">
			<div class="section-label">How it helps</div>
			<h2>A simpler loop for solving the day</h2>
			<p class="soft-text">
				You do not need more dashboard data. You need a place to collect work, reduce the noise, and choose the next useful action fast.
			</p>
		</div>

		<div class="home-simple-steps">
			{#each solutionSteps as step, index}
				<article class="home-simple-step glass-panel">
					<div class="home-step-index">0{index + 1}</div>
					<h3>{step.label}</h3>
					<p class="soft-text mb-0">{step.copy}</p>
				</article>
			{/each}
		</div>
	</section>

	<section class="home-section home-section-simple">
		<div class="home-promo home-promo-simple glass-panel">
			<div>
				<div class="section-label">Start here</div>
				<h2>Open Today and work from a smaller, clearer list.</h2>
				<p class="soft-text mb-0">
					The Today page is where planning turns into execution, with a tighter view of what needs attention first.
				</p>
			</div>
			<a class="btn btn-brand" href="/today">Take action</a>
		</div>
	</section>
</section>
