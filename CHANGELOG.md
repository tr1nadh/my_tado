# Changelog

All notable changes to Karya will be documented in this file.

The format is inspired by Keep a Changelog and uses semantic versioning in a practical way for this project.

## [Unreleased]

### Changed
- This section will track changes that are not released yet.

## [1.0.1] - 2026-04-14

### Changed
- Hid the modes block on the Today page so the day view stays more focused on execution.
- Improved desktop update status in Settings to show current version, up-to-date state, and last checked time.
- Wired GitHub-hosted signed updater release assets for the Tauri desktop app.

## [1.0.0] - 2026-04-14

### Added
- Responsive desktop and mobile layout for the Karya app shell.
- Today, Upcoming, All Actions, and Settings pages.
- Mode-based action organization with create, rename, delete, and reorder flows.
- Natural-language due date detection for action capture and editing.
- Pause, resume, due date, mode change, and other action-level options.
- Today focus mode for one-action-at-a-time execution.
- Search modal for action lookup on desktop and mobile.
- Tauri desktop packaging for Windows.
- Tauri updater wiring with signed desktop release artifacts and in-app update checks.

### Changed
- Inbox was repositioned as `All Actions` in the navigation and overall app language shifted from `tasks` to `actions`.
- Mobile navigation and mobile-first interaction patterns were added across the app.
- Search UX was moved from inline page search to a modal-based flow.

### Fixed
- Drag-and-drop action reordering behavior and hover-action edge cases.
- Modal layering issues across pause, mode, and action option surfaces.
- Date detection save-path issues in action creation and editing.
- Search result action options now work independently from background page rows.
