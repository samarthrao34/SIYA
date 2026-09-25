'use strict';
const fs = require('fs');

function restoreBounds(saved, displays) {
  const width = Math.max(940, Number(saved?.width) || 1280);
  const height = Math.max(600, Number(saved?.height) || 800);
  const bounds = { width, height };
  const x = saved?.x, y = saved?.y;
  if (Number.isFinite(x) && Number.isFinite(y) && displays.some(({ workArea: a }) =>
    x + width > a.x + 80 && x < a.x + a.width - 80 && y >= a.y && y < a.y + a.height - 80
  )) Object.assign(bounds, { x, y });
  return bounds;
}

function loadState(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}

function saveState(file, window) {
  if (window.isDestroyed() || window.isMinimized()) return;
  const state = { ...window.getNormalBounds(), maximized: window.isMaximized() };
  try {
    fs.writeFileSync(file + '.tmp', JSON.stringify(state));
    fs.renameSync(file + '.tmp', file);
  } catch (error) { console.error('Could not save window position:', error.message); }
}
module.exports = { restoreBounds, loadState, saveState };
