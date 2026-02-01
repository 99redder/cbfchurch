const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const indexPath = path.join(root, 'index.html');

function getSidebar(html) {
  const match = html.match(/<aside class="sidebar">[\s\S]*?<\/aside>/);
  if (!match) return null;
  return match[0];
}

function sync() {
  const indexHtml = fs.readFileSync(indexPath, 'utf8');
  const sidebar = getSidebar(indexHtml);
  if (!sidebar) {
    console.error('Sidebar not found in index.html');
    process.exitCode = 1;
    return;
  }

  const files = fs.readdirSync(root).filter((f) => f.endsWith('.html') && f !== 'index.html');
  files.forEach((file) => {
    const filePath = path.join(root, file);
    const html = fs.readFileSync(filePath, 'utf8');
    if (!/<aside class="sidebar">/.test(html)) return;
    const updated = html.replace(/<aside class="sidebar">[\s\S]*?<\/aside>/, sidebar);
    if (updated !== html) {
      fs.writeFileSync(filePath, updated);
    }
  });
}

sync();
