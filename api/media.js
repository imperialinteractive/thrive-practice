export const config = { runtime: 'nodejs' };

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = 'imperialinteractive/thrive-practice';

const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', mp4: 'video/mp4', webm: 'video/webm' };

export default async function handler(req, res) {
  // /media/videos/chewing-cud.mp4 or /media/images/bodyweight-squat.jpg
  const parts = req.url.replace(/\?.*$/, '').split('/media/')[1] || '';
  if (!parts) return res.status(400).send('Bad request');

  const ext = parts.split('.').pop().toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';

  const url = `https://raw.githubusercontent.com/${REPO}/main/public/${parts}?t=${Date.now()}`;
  const ghRes = await fetch(url, {
    headers: GITHUB_TOKEN ? { Authorization: `token ${GITHUB_TOKEN}` } : {}
  });

  if (!ghRes.ok) return res.status(404).send('Not found');

  const buf = await ghRes.arrayBuffer();
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  if (mime.startsWith('video/')) {
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', buf.byteLength);
  }
  res.send(Buffer.from(buf));
}
