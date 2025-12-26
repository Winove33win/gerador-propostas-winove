import { createServer } from 'http';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = process.env.PORT || 3000;
const distDir = path.join(__dirname, 'dist');

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.map': 'application/json; charset=utf-8',
};

const safeResolve = (requestedPath) => {
  const normalized = path.normalize(requestedPath).replace(/^(\.\.(\/|\\|$))+/, '');
  return path.join(distDir, normalized);
};

const serveFile = async (res, filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = contentTypes[ext] || 'application/octet-stream';
  const data = await fs.readFile(filePath);
  res.writeHead(200, { 'Content-Type': contentType });
  res.end(data);
};

const serveIndex = async (res) => {
  const indexPath = path.join(distDir, 'index.html');
  await serveFile(res, indexPath);
};

const server = createServer(async (req, res) => {
  try {
    const urlPath = req.url ? decodeURIComponent(req.url.split('?')[0]) : '/';
    if (urlPath === '/' || urlPath === '') {
      await serveIndex(res);
      return;
    }

    const filePath = safeResolve(urlPath);
    try {
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        await serveFile(res, filePath);
        return;
      }
    } catch {
      // Fall through to SPA index.
    }

    await serveIndex(res);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal Server Error');
  }
});

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
