const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const RENDERER_ROOT = path.join(__dirname, 'src', 'renderer');
const ASSETS_ROOT = path.join(__dirname, 'src', 'assets');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg'
};

function send404(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 Not Found');
}

function safeJoin(root, requestedPath) {
  const resolved = path.normalize(path.join(root, requestedPath));
  if (!resolved.startsWith(root)) return null;
  return resolved;
}

function resolvePath(reqPath) {
  if (reqPath === '/') {
    return path.join(RENDERER_ROOT, 'index.html');
  }

  if (reqPath.startsWith('/assets/')) {
    return safeJoin(ASSETS_ROOT, reqPath.replace('/assets/', ''));
  }

  return safeJoin(RENDERER_ROOT, reqPath.replace(/^\//, ''));
}

const server = http.createServer((req, res) => {
  const reqPath = (req.url || '/').split('?')[0];
  const filePath = resolvePath(reqPath);

  if (!filePath) {
    send404(res);
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      send404(res);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': mimeType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`HydroWeb Web App is running at http://localhost:${PORT}`);
});
