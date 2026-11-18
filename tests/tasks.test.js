import { registerHooks } from 'node:module';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { get } from 'svelte/store';

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '$app/environment') return { url: 'data:text/javascript,export const browser = false', shortCircuit: true };
    return next(specifier, context);
  }
});
const app = await import('../src/lib/tasks.js');
beforeEach(() => {
  app.modes.set(['All Modes', 'Work Sprint', 'Errands']);
  app.tasks.set([{ id: 'task', title: 'Send invoice', mode: 'Work Sprint' }]);
  app.modeIcons.set({ 'Work Sprint': 'fa-code' });
  app.activeMode.set('Work Sprint');
  app.settings.set({ modeTimeBlocks: [{ id: 'block', date: '2026-11-18', mode: 'Work Sprint', startTime: '09:00', endTime: '10:00' }] });
});

test('renaming a mode preserves its scheduled block and custom icon', () => {
  app.renameMode('Work Sprint', 'Deep Work');
  assert.equal(get(app.tasks)[0].mode, 'Deep Work');
  assert.equal(get(app.settings).modeTimeBlocks[0].mode, 'Deep Work');
  assert.equal(get(app.modeIcons)['Deep Work'], 'fa-code');
  assert.equal(get(app.modeIcons)['Work Sprint'], undefined);
});

test('deleting a mode removes its schedule without deleting tasks', () => {
  app.deleteMode('Work Sprint');
  assert.equal(get(app.tasks).length, 1);
  assert.equal(get(app.tasks)[0].mode, 'All Modes');
  assert.deepEqual(get(app.settings).modeTimeBlocks, []);
  assert.equal(get(app.modeIcons)['Work Sprint'], undefined);
});

test('updating settings preserves a pinned timeline', () => {
  app.updateSettings({ todayRailPinned: true });
  app.updateSettings({ todayStarLimit: 3 });
  assert.equal(get(app.settings).todayRailPinned, true);
});

test('removing a detected date does not truncate a word ending in a preposition', async () => {
  const { stripDetectedDateText } = await import('../src/lib/dateDetection.js');
  assert.equal(stripDetectedDateText('Play tomorrow', { start: 5, end: 13 }), 'Play');
  assert.equal(stripDetectedDateText('Send format tomorrow', { start: 12, end: 20 }), 'Send format');
});
