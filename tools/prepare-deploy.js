const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '_site');

const publishItems = [
  'index.html',
  'shows.html',
  'archive.html',
  'about.html',
  'rss.xml',
  'sitemap.xml',
  'style.css',
  'script.js',
  '.nojekyll',
  'images',
  'posts',
  'shows'
];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

for (const item of publishItems) {
  const source = path.join(ROOT, item);
  if (!fs.existsSync(source)) continue;
  fs.cpSync(source, path.join(OUT, item), {
    recursive: true,
    filter: (entry) => path.basename(entry).toLowerCase() !== 'readme.md'
  });
}

const optionalItems = ['CNAME', '404.html'];
for (const item of optionalItems) {
  const source = path.join(ROOT, item);
  if (fs.existsSync(source)) fs.copyFileSync(source, path.join(OUT, item));
}

console.log(`Prepared GitHub Pages bundle at ${OUT}`);
