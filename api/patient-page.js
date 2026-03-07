export const config = { runtime: 'nodejs' };

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = 'imperialinteractive/thrive-practice';
const THRIVE_KEY = process.env.THRIVE_KEY || 'thrive-steph-2026';

async function getDataFile(filename) {
  const res = await fetch(`https://raw.githubusercontent.com/${REPO}/main/${filename}?t=${Date.now()}`, {
    headers: GITHUB_TOKEN ? { Authorization: `token ${GITHUB_TOKEN}` } : {}
  });
  if (!res.ok) return null;
  return res.json();
}

async function getImageB64(name) {
  if (!name) return null;
  const res = await fetch(`https://raw.githubusercontent.com/${REPO}/main/images/${name}.jpg`, {
    headers: GITHUB_TOKEN ? { Authorization: `token ${GITHUB_TOKEN}` } : {}
  });
  if (!res.ok) return null;
  const buf = await res.arrayBuffer();
  return Buffer.from(buf).toString('base64');
}

async function getVideoB64(name) {
  if (!name) return null;
  const res = await fetch(`https://raw.githubusercontent.com/${REPO}/main/videos/${name}.mp4`, {
    headers: GITHUB_TOKEN ? { Authorization: `token ${GITHUB_TOKEN}` } : {}
  });
  if (!res.ok) return null;
  const buf = await res.arrayBuffer();
  return Buffer.from(buf).toString('base64');
}

export default async function handler(req, res) {
  const slug = req.url.split('/p/')[1]?.split('?')[0] || '';
  const key = req.headers['x-thrive-key'] || new URL(req.url, 'http://x').searchParams.get('key') || '';

  if (req.method === 'POST') {
    // Handle tracking POST
    if (key !== THRIVE_KEY) return res.status(401).json({ error: 'unauthorized' });
    // For now just acknowledge
    return res.status(200).json({ ok: true });
  }

  const data = await getDataFile('data.json');
  if (!data) return res.status(500).send('<h1>Error loading data</h1>');

  const patient = data.patients?.find(p => p.slug === slug);
  if (!patient) return res.status(404).send(notFoundHTML());

  // Build exercise list with photos
  const exercises = [];
  for (const prog of patient.program) {
    const ex = data.exercises?.find(e => e.id === prog.exerciseId);
    if (!ex) continue;
    const b64 = await getImageB64(ex.photo);
    const videoB64 = await getVideoB64(ex.video);
    exercises.push({ ...ex, ...prog, b64, videoB64 });
  }

  res.setHeader('Content-Type', 'text/html');
  res.send(renderPatientPage(patient, exercises));
}

function notFoundHTML() {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Not Found</title></head><body style="font-family:sans-serif;text-align:center;padding:60px;color:#555"><h2>Program not found</h2><p>Ask your therapist for the correct link.</p></body></html>`;
}

function renderPatientPage(patient, exercises) {
  const exerciseHTML = exercises.map((ex, i) => {
    const mediaTag = ex.videoB64
      ? `<video controls playsinline style="width:100%;border-radius:12px;margin:12px 0;" preload="metadata">
          <source src="data:video/mp4;base64,${ex.videoB64}" type="video/mp4">
        </video>`
      : ex.b64
        ? `<img src="data:image/jpeg;base64,${ex.b64}" style="width:100%;border-radius:12px;margin:12px 0;" alt="${ex.name}">`
        : '';
    const imgTag = mediaTag;
    const cuesHTML = ex.cues?.length
      ? `<ul style="margin:8px 0 0;padding-left:18px;">${ex.cues.map(c => `<li style="font-size:13px;color:#7a6a5e;margin-bottom:4px;">${c}</li>`).join('')}</ul>`
      : '';
    return `
    <div style="background:#e8e0d5;border-radius:20px;padding:20px;margin-bottom:16px;">
      <div style="font-size:13px;font-weight:700;color:#8b6f5e;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:8px;">Exercise ${i + 1}</div>
      <div style="font-size:18px;font-weight:700;color:#3d2e26;margin-bottom:6px;">${ex.name}</div>
      ${imgTag}
      <div style="font-size:14px;color:#3d2e26;line-height:1.6;margin-bottom:8px;">${ex.description}</div>
      ${cuesHTML}
      <div style="display:flex;gap:12px;margin:14px 0 4px;">
        <div style="background:#fff8f3;border-radius:12px;padding:10px 16px;text-align:center;flex:1;">
          <div style="font-size:22px;font-weight:700;color:#8b6f5e;">${ex.sets}</div>
          <div style="font-size:11px;color:#7a6a5e;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Sets</div>
        </div>
        <div style="background:#fff8f3;border-radius:12px;padding:10px 16px;text-align:center;flex:1;">
          <div style="font-size:22px;font-weight:700;color:#8b6f5e;">${ex.reps}</div>
          <div style="font-size:11px;color:#7a6a5e;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Reps</div>
        </div>
      </div>
      ${ex.notes ? `<div style="font-size:13px;color:#7a9e7e;font-weight:600;margin-top:8px;">📋 ${ex.notes}</div>` : ''}
      <div style="margin-top:16px;">
        <div style="font-size:12px;font-weight:700;color:#7a6a5e;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Today's Tracker</div>
        <div id="tracker-${i}" style="display:flex;gap:8px;flex-wrap:wrap;">
          ${Array.from({length: ex.sets}, (_, s) => `
            <button onclick="toggleSet(${i},${s})" id="set-${i}-${s}"
              style="width:44px;height:44px;border-radius:50%;border:2px solid #8b6f5e;background:#fff8f3;font-size:13px;font-weight:700;color:#8b6f5e;cursor:pointer;transition:all 0.15s;">
              ${s + 1}
            </button>`).join('')}
        </div>
        <div id="done-msg-${i}" style="display:none;margin-top:10px;font-size:14px;font-weight:700;color:#7a9e7e;">✅ All sets done! Great work 💪</div>
      </div>
    </div>`;
  }).join('');

  const today = new Date().toLocaleDateString('en-CA');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>Thrive — ${patient.name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, Georgia, serif; background: #f0ebe3; color: #3d2e26; max-width: 480px; margin: 0 auto; min-height: 100vh; }
  button { font-family: -apple-system, sans-serif; }
</style>
</head>
<body>
<div style="background:#8b6f5e;padding:20px 20px 18px;position:sticky;top:0;z-index:10;">
  <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.5px;">Thrive 🌿</div>
  <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:2px;">Home Program — ${patient.name}</div>
</div>

<div style="padding:16px 16px 80px;">
  <div style="background:#e8e0d5;border-radius:16px;padding:14px 16px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;">
    <div>
      <div style="font-size:12px;font-weight:700;color:#7a6a5e;text-transform:uppercase;letter-spacing:0.5px;">Today</div>
      <div style="font-size:15px;font-weight:700;color:#3d2e26;margin-top:2px;" id="today-label"></div>
    </div>
    <div id="daily-progress" style="font-size:13px;font-weight:700;color:#8b6f5e;"></div>
  </div>

  ${exerciseHTML}

  <div style="text-align:center;padding:20px 0;font-size:13px;color:#7a6a5e;">
    Program by <strong style="color:#8b6f5e;">Steph Raitt</strong><br>
    <span style="font-size:12px;">Questions? Contact your therapist.</span>
  </div>
</div>

<script>
const TODAY = '${today}';
const SETS_TOTAL = [${exercises.map(e => e.sets).join(',')}];
const completedSets = JSON.parse(localStorage.getItem('thrive-sets-' + TODAY) || '{}');

function saveState() {
  localStorage.setItem('thrive-sets-' + TODAY, JSON.stringify(completedSets));
  updateProgress();
}

function toggleSet(exIdx, setIdx) {
  const key = exIdx + '-' + setIdx;
  completedSets[key] = !completedSets[key];
  const btn = document.getElementById('set-' + exIdx + '-' + setIdx);
  if (completedSets[key]) {
    btn.style.background = '#7a9e7e';
    btn.style.borderColor = '#7a9e7e';
    btn.style.color = '#fff';
  } else {
    btn.style.background = '#fff8f3';
    btn.style.borderColor = '#8b6f5e';
    btn.style.color = '#8b6f5e';
  }
  // Check if all sets done for this exercise
  const allDone = Array.from({length: SETS_TOTAL[exIdx]}, (_, s) => completedSets[exIdx + '-' + s]).every(Boolean);
  const msg = document.getElementById('done-msg-' + exIdx);
  if (msg) msg.style.display = allDone ? 'block' : 'none';
  saveState();
}

function updateProgress() {
  const total = SETS_TOTAL.reduce((a,b) => a+b, 0);
  const done = Object.values(completedSets).filter(Boolean).length;
  const el = document.getElementById('daily-progress');
  if (el) el.textContent = done + ' / ' + total + ' sets done';
}

function restoreState() {
  Object.entries(completedSets).forEach(([key, val]) => {
    if (!val) return;
    const [exIdx, setIdx] = key.split('-');
    const btn = document.getElementById('set-' + exIdx + '-' + setIdx);
    if (btn) { btn.style.background = '#7a9e7e'; btn.style.borderColor = '#7a9e7e'; btn.style.color = '#fff'; }
  });
  SETS_TOTAL.forEach((total, i) => {
    const allDone = Array.from({length: total}, (_, s) => completedSets[i + '-' + s]).every(Boolean);
    const msg = document.getElementById('done-msg-' + i);
    if (msg) msg.style.display = allDone ? 'block' : 'none';
  });
  updateProgress();
}

// Set today label
const d = new Date();
const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
document.getElementById('today-label').textContent = days[d.getDay()] + ', ' + months[d.getMonth()] + ' ' + d.getDate();

restoreState();
</script>
</body>
</html>`;
}
