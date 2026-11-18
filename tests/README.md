# Regression checks

Run `npm test` (Node 22.15+). The tests exercise the real task stores and date parser; only SvelteKit's browser flag is replaced for the Node environment.

Browser checks performed against the local Vite app:

- Today, All, Upcoming: enter an action, verify the count and enabled submit button, submit, and verify the new task appears.
- Submit with Ctrl+Enter; a dated Upcoming action retains its detected due date.
- Capture autofocus, Tab wrapping, Escape dismissal, and return focus to the Add Action button.
- All search opens one dialog, rather than opening Today search underneath.
- Tasks remain visible between schedule blocks.
- At 390×844 and 1366×900, task content stays within the viewport; mobile action buttons remain reachable.
- All search overlays the viewport above navigation after the entrance animation finishes.
- No browser console errors during these checks.

Not verified: native Tauri packaging, physical touch devices, screen readers, and every schedule/drag edge case. The production build still reports existing accessibility and unused-export warnings.
