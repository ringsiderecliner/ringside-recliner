const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 4173);
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.xml':'application/xml; charset=utf-8', '.svg':'image/svg+xml', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.webp':'image/webp', '.gif':'image/gif', '.md':'text/plain; charset=utf-8' };

function build() {
  const result = spawnSync(process.execPath, [path.join(__dirname, 'build.js')], { stdio: 'inherit' });
  if (result.status !== 0) console.error('Build failed. Fix the message above and save again.');
}
build();

let timer;
for (const watchPath of [path.join(ROOT, 'content'), path.join(ROOT, 'site.config.json')]) {
  try {
    fs.watch(watchPath, { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(build, 150);
    });
  } catch (error) {
    console.warn(`Could not watch ${watchPath}: ${error.message}`);
  }
}

http.createServer((req, res) => {
  const clean = decodeURIComponent((req.url || '/').split('?')[0]);
  const requested = clean === '/' ? '/index.html' : clean;
  const file = path.resolve(ROOT, `.${requested}`);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control':'no-store' });
    fs.createReadStream(file).pipe(res);
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Ringside Recliner is running at http://localhost:${PORT}`);
  console.log('Edit Markdown files in content/ and refresh the browser after saving.');
});
