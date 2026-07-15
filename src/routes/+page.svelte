<script>
	import { onMount } from 'svelte';

	const features = [
		{ title: 'Smart Task Management', desc: 'Auto-organize your day by what needs attention most.', icon: 'M13 10V3L4 14h7v7l9-11h-7z' }, 
		{ title: 'Categories & Organization', desc: 'Group actions logically so nothing slips through.', icon: 'M4 6h16M4 12h16m-7 6h7' }, 
		{ title: 'Priorities', desc: 'Flag the essential work that must get done today.', icon: 'M3 21v-8m0 0V3a2 2 0 012-2h12.5a.5.5 0 01.35.85l-2.5 2.65 2.5 2.65a.5.5 0 01-.35.85H5z' }, 
		{ title: 'Due Dates & Reminders', desc: 'Never miss a deadline. Get timely nudges.', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' }, 
		{ title: 'Daily Planner', desc: 'A dedicated view to shape your perfect day.', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' }, 
		{ title: 'Minimal & Distraction-Free', desc: 'A clean interface that stays out of your way.', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2 12h.01M22 12h.01' }, 
		{ title: 'Fast Search', desc: 'Find any task instantly with keyboard shortcuts.', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' }, 
		{ title: 'Progress Tracking', desc: 'See how far you have come and stay motivated.', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' } 
	];

	const whyCards = [
		{ title: 'Focus over bloat', text: 'Unlike heavy project management tools, Karya gives you exactly what you need to act.' },
		{ title: 'Built for speed', text: 'Keyboard shortcuts, instant loading, and minimal clicks to get things done.' },
		{ title: 'Aesthetic clarity', text: 'Dark Indian Minimalism reduces eye strain and keeps you zeroed in on your work.' }
	];

	const solutionSteps = [
		{ label: 'Capture', copy: 'Keep every action in one place instead of juggling it in your head.' },
		{ label: 'Reduce', copy: 'Let Today surface only what deserves attention right now.' },
		{ label: 'Move', copy: 'Start with one clear next step and build momentum from there.' }
	];

	onMount(() => {
		const observer = new IntersectionObserver((entries) => {
			entries.forEach(entry => {
				if (entry.isIntersecting) {
					entry.target.classList.add('visible');
				}
			});
		}, { threshold: 0.1 });

		document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));
		
		return () => {
			observer.disconnect();
		};
	});
</script>

<svelte:head>
	<title>Karya | Do What Matters</title>
</svelte:head>

<div class="landing-page">
	<!-- Hero Section -->
	<header class="hero section animate-on-scroll">
		<div class="hero-content">
			<div class="badge">Introducing Karya 2.0</div>
			<h1 class="hero-title">Decide less. <span class="text-amber">Do more.</span></h1>
			<p class="hero-subtitle">
				When everything feels important, the real problem is deciding what to do now.
				Karya helps you cut through the noise, narrow the day down, and act on what matters.
			</p>
			<div class="hero-actions">
				<a href="/today" class="btn btn-primary btn-large">Start Planning</a>
				<a href="#how-it-works" class="btn btn-secondary btn-large">See how it works</a>
			</div>
		</div>

		<div class="hero-mockup-wrapper animate-on-scroll delay-1">
			<div class="hero-glow"></div>
			<div class="hero-mockup">
				<!-- CSS App Preview Mockup -->
				<div class="mockup-header">
					<div class="mockup-dots"><span></span><span></span><span></span></div>
					<div class="mockup-title">Today — Karya</div>
				</div>
				<div class="mockup-body">
					<div class="mockup-sidebar">
						<div class="mockup-nav-item active"></div>
						<div class="mockup-nav-item"></div>
						<div class="mockup-nav-item"></div>
					</div>
					<div class="mockup-main">
						<div class="mockup-task-group">
							<div class="mockup-task-item"><div class="check"></div><div class="line"></div></div>
							<div class="mockup-task-item highlight"><div class="check"></div><div class="line w-long"></div><div class="tag"></div></div>
							<div class="mockup-task-item"><div class="check"></div><div class="line w-short"></div></div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</header>

	<!-- Features Section -->
	<section id="features" class="features section">
		<div class="section-header animate-on-scroll">
			<h2 class="section-title">Everything you need. <br/>Nothing you don't.</h2>
			<p class="section-subtitle">Crafted with precision to help you maintain flow state all day long.</p>
		</div>

		<div class="features-grid">
			{#each features as feature, i}
				<div class="feature-card glass-panel animate-on-scroll" style="--animation-order: {i};">
					<div class="feature-icon">
						<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
							<path d="{feature.icon}"></path>
						</svg>
					</div>
					<h3 class="feature-title">{feature.title}</h3>
					<p class="feature-desc soft-text">{feature.desc}</p>
				</div>
			{/each}
		</div>
	</section>

	<!-- Why Karya Section -->
	<section class="why-karya section">
		<div class="section-header animate-on-scroll">
			<h2 class="section-title">Why Karya?</h2>
		</div>
		<div class="bento-grid">
			{#each whyCards as card, i}
				<div class="bento-card glass-panel animate-on-scroll" style="--animation-order: {i};">
					<h3>{card.title}</h3>
					<p class="soft-text">{card.text}</p>
				</div>
			{/each}
		</div>
	</section>

	<!-- How It Works Section -->
	<section id="how-it-works" class="how-it-works section">
		<div class="section-header animate-on-scroll">
			<h2 class="section-title">A simpler loop for solving the day</h2>
			<p class="section-subtitle">You don't need more dashboard data. You need a place to collect work, reduce noise, and choose the next action fast.</p>
		</div>

		<div class="steps-container">
			{#each solutionSteps as step, index}
				<div class="step-card animate-on-scroll" style="--animation-order: {index};">
					<div class="step-number">0{index + 1}</div>
					<div class="step-content glass-panel">
						<h3>{step.label}</h3>
						<p class="soft-text mb-0">{step.copy}</p>
					</div>
					{#if index < solutionSteps.length - 1}
						<div class="step-connector"></div>
					{/if}
				</div>
			{/each}
		</div>
	</section>

	<!-- CTA Section -->
	<section class="cta-section section animate-on-scroll">
		<div class="cta-box glass-panel">
			<h2>Ready to clear the noise?</h2>
			<p class="soft-text">Join those who have chosen focus over friction.</p>
			<a href="/today" class="btn btn-primary btn-large">Take Action Now</a>
		</div>
	</section>

	<!-- Footer -->
	<footer class="footer">
		<div class="footer-content">
			<div class="footer-brand">
				<div class="footer-logo">Karya</div>
				<p class="soft-text">Dark Indian Minimalism applied to productivity.</p>
			</div>
			<div class="footer-links">
				<div class="link-group">
					<h4>App</h4>
					<a href="/today">Today</a>
					<a href="/inbox">Inbox</a>
					<a href="/settings">Settings</a>
				</div>
				<div class="link-group">
					<h4>Connect</h4>
					<a href="#">Twitter</a>
					<a href="#">GitHub</a>
				</div>
			</div>
		</div>
		<div class="footer-bottom soft-text">
			&copy; {new Date().getFullYear()} Karya. All rights reserved.
		</div>
	</footer>
</div>

<style>
	:global(body) {
		background-color: var(--bg-deep, #0F0D0C);
		color: var(--text, #E7E5E4);
		scroll-behavior: smooth;
	}

	.landing-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
		overflow-x: hidden;
	}

	.section {
		width: 100%;
		max-width: 1200px;
		padding: 6rem 2rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		position: relative;
	}

	.section-header {
		text-align: center;
		margin-bottom: 4rem;
		max-width: 700px;
	}

	.section-title {
		font-size: clamp(2.5rem, 5vw, 3.5rem);
		font-weight: 800;
		line-height: 1.1;
		margin-bottom: 1rem;
		letter-spacing: -0.02em;
	}

	.section-subtitle {
		font-size: 1.25rem;
		color: var(--soft-text);
		line-height: 1.6;
	}

	.text-amber {
		color: var(--amber, #D97706);
		text-shadow: 0 0 30px rgba(217, 119, 6, 0.3);
	}

	.mb-0 {
		margin-bottom: 0;
	}

	/* Hero Section */
	.hero {
		padding-top: 8rem;
		padding-bottom: 4rem;
		text-align: center;
	}

	.hero-content {
		max-width: 800px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
		z-index: 2;
	}

	.badge {
		padding: 0.5rem 1rem;
		background: rgba(217, 119, 6, 0.1);
		color: var(--amber);
		border: 1px solid rgba(217, 119, 6, 0.2);
		border-radius: 99px;
		font-size: 0.875rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.hero-title {
		font-size: clamp(3.5rem, 8vw, 5.5rem);
		font-weight: 800;
		line-height: 1.05;
		letter-spacing: -0.03em;
		margin: 0;
	}

	.hero-subtitle {
		font-size: clamp(1.125rem, 3vw, 1.35rem);
		color: var(--soft-text);
		max-width: 650px;
		line-height: 1.6;
	}

	.hero-actions {
		display: flex;
		gap: 1rem;
		margin-top: 1.5rem;
		flex-wrap: wrap;
		justify-content: center;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.75rem 1.5rem;
		border-radius: 10px;
		font-weight: 600;
		font-size: 1rem;
		transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
		cursor: pointer;
		text-decoration: none;
	}

	.btn-large {
		padding: 1rem 2.25rem;
		font-size: 1.125rem;
	}

	.btn-primary {
		background: var(--amber, #D97706);
		color: #fff;
		border: none;
		box-shadow: 0 8px 20px -6px rgba(217, 119, 6, 0.6);
	}

	.btn-primary:hover {
		background: var(--blue-strong, #B45309);
		transform: translateY(-2px) scale(1.02);
		box-shadow: 0 12px 25px -6px rgba(217, 119, 6, 0.7);
	}

	.btn-secondary {
		background: var(--surface-light, #332E2B);
		color: var(--text);
		border: 1px solid var(--line);
	}

	.btn-secondary:hover {
		background: var(--surface-lighter, #443F3B);
		transform: translateY(-2px) scale(1.02);
	}

	/* Hero Mockup */
	.hero-mockup-wrapper {
		margin-top: 6rem;
		width: 100%;
		max-width: 900px;
		position: relative;
		perspective: 1200px;
	}

	.hero-glow {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 90%;
		height: 90%;
		background: radial-gradient(circle, rgba(217,119,6,0.18) 0%, rgba(0,0,0,0) 60%);
		filter: blur(80px);
		z-index: 0;
	}

	.hero-mockup {
		position: relative;
		z-index: 1;
		background: var(--panel, #262220);
		border: 1px solid var(--line-strong, #4D4742);
		border-radius: 20px;
		overflow: hidden;
		box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255,255,255,0.05) inset;
		transform: rotateX(8deg) scale(0.95);
		transition: transform 0.8s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.8s ease;
	}

	.hero-mockup-wrapper:hover .hero-mockup {
		transform: rotateX(0deg) scale(1);
		box-shadow: 0 40px 80px -20px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255,255,255,0.05) inset;
	}

	.mockup-header {
		display: flex;
		align-items: center;
		padding: 1.2rem;
		background: var(--panel-strong, #2D2927);
		border-bottom: 1px solid var(--line);
	}

	.mockup-dots {
		display: flex;
		gap: 8px;
	}

	.mockup-dots span {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--line-strong);
	}
	.mockup-dots span:nth-child(1) { background: #EF4444; }
	.mockup-dots span:nth-child(2) { background: #F59E0B; }
	.mockup-dots span:nth-child(3) { background: #10B981; }

	.mockup-title {
		flex: 1;
		text-align: center;
		font-size: 0.9rem;
		color: var(--muted);
		font-weight: 500;
	}

	.mockup-body {
		display: flex;
		height: 450px;
	}

	.mockup-sidebar {
		width: 220px;
		border-right: 1px solid var(--line);
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.2rem;
		background: rgba(0,0,0,0.1);
	}

	.mockup-nav-item {
		height: 28px;
		border-radius: 8px;
		background: var(--line);
		opacity: 0.4;
	}

	.mockup-nav-item.active {
		background: rgba(217, 119, 6, 0.25);
		opacity: 1;
	}

	.mockup-main {
		flex: 1;
		padding: 2.5rem;
		background: var(--bg);
	}

	.mockup-task-group {
		display: flex;
		flex-direction: column;
		gap: 1.2rem;
	}

	.mockup-task-item {
		display: flex;
		align-items: center;
		gap: 1.2rem;
		padding: 1.2rem;
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 12px;
		transition: transform 0.2s ease, box-shadow 0.2s ease;
	}

	.mockup-task-item:hover {
		transform: translateX(4px);
	}

	.mockup-task-item.highlight {
		border-color: rgba(217, 119, 6, 0.6);
		box-shadow: 0 8px 24px rgba(0,0,0,0.3);
		background: linear-gradient(90deg, rgba(217, 119, 6, 0.05), transparent);
	}

	.check {
		width: 22px;
		height: 22px;
		border-radius: 6px;
		border: 2px solid var(--line-strong);
	}

	.mockup-task-item.highlight .check {
		border-color: var(--amber);
	}

	.line {
		height: 14px;
		border-radius: 6px;
		background: var(--line-strong);
		flex: 1;
	}

	.w-long { max-width: 85%; }
	.w-short { max-width: 55%; }

	.tag {
		width: 48px;
		height: 24px;
		border-radius: 6px;
		background: rgba(217, 119, 6, 0.2);
	}

	/* Features Grid */
	.features-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1.5rem;
		width: 100%;
	}

	.feature-card {
		padding: 2.5rem;
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 20px;
		transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
		position: relative;
		overflow: hidden;
		z-index: 1;
	}

	.feature-card::before {
		content: '';
		position: absolute;
		top: 0; left: 0; right: 0; bottom: 0;
		background: radial-gradient(circle at top right, rgba(217, 119, 6, 0.08) 0%, transparent 60%);
		opacity: 0;
		transition: opacity 0.4s ease;
		z-index: -1;
	}

	.feature-card:hover {
		transform: translateY(-8px);
		border-color: rgba(217, 119, 6, 0.4);
		box-shadow: 0 20px 40px -15px rgba(0,0,0,0.5);
	}

	.feature-card:hover::before {
		opacity: 1;
	}

	.feature-icon {
		width: 56px;
		height: 56px;
		border-radius: 14px;
		background: rgba(217, 119, 6, 0.1);
		color: var(--amber);
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 2rem;
		transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
	}

	.feature-card:hover .feature-icon {
		transform: scale(1.1) rotate(-5deg);
		background: rgba(217, 119, 6, 0.2);
	}

	.feature-icon svg {
		width: 28px;
		height: 28px;
	}

	.feature-title {
		font-size: 1.35rem;
		font-weight: 700;
		margin-bottom: 0.75rem;
		color: var(--text-light);
	}

	/* Bento Grid */
	.bento-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1.5rem;
		width: 100%;
	}

	.bento-card {
		padding: 3rem;
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 24px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		transition: border-color 0.3s ease, box-shadow 0.3s ease;
	}

	.bento-card:hover {
		border-color: rgba(217, 119, 6, 0.2);
		box-shadow: 0 10px 30px -10px rgba(0,0,0,0.3);
	}

	.bento-card:nth-child(1) { grid-column: span 2; }
	.bento-card:nth-child(2) { grid-column: span 1; background: linear-gradient(135deg, var(--panel), var(--panel-strong)); }
	.bento-card:nth-child(3) { grid-column: span 3; align-items: center; text-align: center; }

	.bento-card h3 {
		font-size: 1.75rem;
		font-weight: 700;
		margin-bottom: 1rem;
		color: var(--text-light);
	}

	.bento-card p {
		font-size: 1.125rem;
		line-height: 1.6;
	}

	@media (max-width: 768px) {
		.bento-grid {
			grid-template-columns: 1fr;
		}
		.bento-card:nth-child(1), .bento-card:nth-child(2), .bento-card:nth-child(3) {
			grid-column: span 1;
		}
		.bento-card {
			padding: 2rem;
		}
	}

	/* How It Works */
	.steps-container {
		display: flex;
		flex-direction: column;
		gap: 2rem;
		width: 100%;
		max-width: 650px;
	}

	.step-card {
		display: flex;
		gap: 2rem;
		position: relative;
	}

	.step-number {
		font-size: 3rem;
		font-weight: 800;
		color: rgba(255,255,255,0.05);
		-webkit-text-stroke: 1px var(--line-strong);
		line-height: 1;
		padding-top: 1rem;
		min-width: 60px;
	}

	.step-content {
		flex: 1;
		padding: 2.5rem;
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 20px;
		transition: transform 0.3s ease;
	}

	.step-card:hover .step-content {
		transform: translateX(8px);
		border-color: rgba(217, 119, 6, 0.3);
	}

	.step-content h3 {
		font-size: 1.5rem;
		font-weight: 700;
		margin-bottom: 0.75rem;
	}

	.step-connector {
		position: absolute;
		left: 30px;
		top: 4.5rem;
		bottom: -2.5rem;
		width: 2px;
		background: linear-gradient(180deg, var(--line-strong) 0%, rgba(217, 119, 6, 0.5) 100%);
		z-index: -1;
	}

	.step-card:last-child .step-connector {
		display: none;
	}

	@media (max-width: 600px) {
		.step-card {
			flex-direction: column;
			gap: 1rem;
		}
		.step-connector {
			display: none;
		}
		.step-number {
			padding-top: 0;
			font-size: 2.5rem;
		}
	}

	/* CTA */
	.cta-box {
		width: 100%;
		padding: 5rem 2rem;
		text-align: center;
		background: linear-gradient(180deg, var(--panel) 0%, var(--panel-strong) 100%);
		border: 1px solid var(--line);
		border-radius: 24px;
		position: relative;
		overflow: hidden;
	}

	.cta-box::after {
		content: '';
		position: absolute;
		top: -50%; right: -10%;
		width: 400px; height: 400px;
		background: var(--amber);
		filter: blur(200px);
		opacity: 0.15;
		border-radius: 50%;
		z-index: 0;
	}
	
	.cta-box::before {
		content: '';
		position: absolute;
		bottom: -50%; left: -10%;
		width: 300px; height: 300px;
		background: var(--amber);
		filter: blur(150px);
		opacity: 0.1;
		border-radius: 50%;
		z-index: 0;
	}

	.cta-box h2 {
		font-size: clamp(2rem, 5vw, 3rem);
		font-weight: 800;
		margin-bottom: 1.5rem;
		position: relative;
		z-index: 1;
	}

	.cta-box .soft-text {
		margin-bottom: 2.5rem;
		font-size: 1.25rem;
		max-width: 500px;
		margin-left: auto;
		margin-right: auto;
		position: relative;
		z-index: 1;
	}

	.cta-box .btn {
		position: relative;
		z-index: 1;
	}

	/* Footer */
	.footer {
		width: 100%;
		border-top: 1px solid var(--line);
		padding: 5rem 2rem 2rem;
		background: var(--bg-deep);
	}

	.footer-content {
		max-width: 1200px;
		margin: 0 auto;
		display: flex;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 3rem;
		margin-bottom: 4rem;
	}

	.footer-brand .footer-logo {
		font-size: 1.75rem;
		font-weight: 800;
		color: var(--text-light);
		margin-bottom: 1rem;
		letter-spacing: -0.02em;
	}
	
	.footer-brand .soft-text {
		max-width: 250px;
	}

	.footer-links {
		display: flex;
		gap: 5rem;
		flex-wrap: wrap;
	}

	.link-group h4 {
		font-size: 1.1rem;
		font-weight: 600;
		margin-bottom: 1.2rem;
		color: var(--text-light);
	}

	.link-group a {
		display: block;
		color: var(--soft-text);
		text-decoration: none;
		margin-bottom: 0.85rem;
		transition: color 0.2s, transform 0.2s;
	}

	.link-group a:hover {
		color: var(--amber);
		transform: translateX(2px);
	}

	.footer-bottom {
		max-width: 1200px;
		margin: 0 auto;
		text-align: center;
		padding-top: 2rem;
		border-top: 1px solid var(--line);
	}

	/* Animations */
	@media (prefers-reduced-motion: no-preference) {
		.animate-on-scroll {
			opacity: 0;
			transform: translateY(30px);
			transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
		}
		:global(.animate-on-scroll.visible) {
			opacity: 1;
			transform: translateY(0);
		}
		
		:global(.feature-card.visible), :global(.bento-card.visible), :global(.step-card.visible) {
			transition-delay: calc(var(--animation-order, 0) * 0.15s);
		}

		.delay-1 { transition-delay: 0.3s; }
	}

	@media (prefers-reduced-motion: reduce) {
		.animate-on-scroll {
			opacity: 1;
			transform: none;
		}
	}
</style>
