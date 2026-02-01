const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const syncScript = path.join(__dirname, 'sync-sidebar.js');

let timer = null;

function runSync() {
  try {
    execFileSync(process.execPath, [syncScript], { stdio: 'inherit' });
  } catch (err) {
    console.error('Failed to sync sidebar:', err.message);
  }
}

function scheduleSync() {
  clearTimeout(timer);
  timer = setTimeout(runSync, 200);
}

fs.watch(indexPath, { persistent: true }, (eventType) => {
  if (eventType === 'change') scheduleSync();
});

console.log('Watching index.html for sidebar changes...');
console.log('Press Ctrl+C to stop.');
