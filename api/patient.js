import { kv } from './lib/kv.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const url = new URL(req.url);
  const slug = url.pathname.split('/p/')[1]?.split('?')[0] || url.searchParams.get('slug') || '';
  const key = req.headers.get('x-thrive-key') || url.searchParams.get('key') || '';
  
  const AUTH_KEY = process.env.THRIVE_KEY || 'thrive-steph-2026';

  if (req.method === 'GET') {
    // Public patient page — fetch patient data
    const data = await kv.get(`patient:${slug}`);
    if (!data) return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
  }

  // Write operations require auth
  if (key !== AUTH_KEY) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  if (req.method === 'POST') {
    const body = await req.json();
    await kv.set(`patient:${body.slug}`, body.data);
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  }

  return new Response('Method not allowed', { status: 405 });
}
