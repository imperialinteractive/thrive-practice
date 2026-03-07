export const config = { runtime: 'nodejs' };

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = 'imperialinteractive/thrive-practice';
const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', mp4: 'video/mp4', webm: 'video/webm' };

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://x');
  // Try query param first (?path=videos/chewing-cud.mp4), then URL path
  let filePath = url.searchParams.get('path') || req.url.replace(/\?.*$/, '').replace(/^\/media\//, '');
  if (!filePath) return res.status(400).send('Bad request');

  const ext = filePath.split('.').pop().toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';

  const rawUrl = `https://raw.githubusercontent.com/${REPO}/main/public/${filePath}`;
  const ghRes = await fetch(rawUrl, {
    headers: GITHUB_TOKEN ? { Authorization: `token ${GITHUB_TOKEN}` } : {}
  });

  if (!ghRes.ok) return res.status(404).send('Not found: ' + filePath);

  const buf = await ghRes.arrayBuffer();
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader('Content-Length', buf.byteLength);
  if (mime.startsWith('video/')) res.setHeader('Accept-Ranges', 'bytes');
  res.send(Buffer.from(buf));
}
