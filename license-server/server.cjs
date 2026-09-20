// Servidor de licencias NutraFlow CRM (referencia mínima, cero dependencias).
// Uso: node server.mjs  (escucha en LICENSE_PORT o 4100)
// Endpoints:
//   POST /api/checkin  { install_id, hwid, app_version, company }
//     -> { status: 'active'|'blocked', seats, plan, message, server_time }
//   GET  /api/installations            (lista, para tu panel; protégelo con ADMIN_TOKEN)
//   POST /api/installations/:id/block  { blocked: true|false }  (revocar / rehabilitar)
//
// Almacenamiento: installations.json junto a este archivo (cámbialo por Postgres
// con license-server/schema.sql cuando crezca).
// Protocolo que espera el CRM: ver MANUAL_LICENCIAS.md "Protocolo check-in".

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.LICENSE_PORT || 4100);
const ADMIN_TOKEN = process.env.LICENSE_ADMIN_TOKEN || '';
const STORE = path.join(__dirname, 'installations.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(STORE, 'utf8'));
  } catch {
    return {};
  }
}
function save(all) {
  fs.writeFileSync(STORE, JSON.stringify(all, null, 2));
}

function body(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', (c) => { s += c; if (s.length > 64 * 1024) req.destroy(); });
    req.on('end', () => {
      try { resolve(s ? JSON.parse(s) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'POST' && url.pathname === '/api/checkin') {
      const p = await body(req);
      const installId = String(p.install_id || '').slice(0, 64);
      if (!installId) return json(res, 400, { status: 'blocked', message: 'install_id requerido' });
      const all = load();
      const now = new Date().toISOString();
      const rec = all[installId] || {
        install_id: installId, hwid: '', app_version: '', company: '',
        plan: 'PRO', status: 'active', seats: 1, note: '',
        first_seen: now, last_seen: now,
      };
      rec.hwid = String(p.hwid || '').slice(0, 32);
      rec.app_version = String(p.app_version || '').slice(0, 32);
      rec.company = String(p.company || '').slice(0, 120);
      rec.last_seen = now;
      all[installId] = rec;
      save(all);
      return json(res, 200, {
        status: rec.status === 'blocked' ? 'blocked' : 'active',
        seats: rec.seats,
        plan: rec.plan,
        message: rec.status === 'blocked' ? 'Licencia bloqueada por el proveedor.' : 'Licencia verificada en línea',
        server_time: now,
      });
    }

    // --- Administración simple (requiere LICENSE_ADMIN_TOKEN) ---
    const token = req.headers['x-admin-token'] || '';
    if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
      return json(res, 401, { error: 'unauthorized' });
    }
    if (req.method === 'GET' && url.pathname === '/api/installations') {
      return json(res, 200, { installations: Object.values(load()) });
    }
    const m = url.pathname.match(/^\/api\/installations\/([^/]+)\/block$/);
    if (req.method === 'POST' && m) {
      const p = await body(req);
      const all = load();
      const rec = all[decodeURIComponent(m[1])];
      if (!rec) return json(res, 404, { error: 'not found' });
      rec.status = p.blocked ? 'blocked' : 'active';
      save(all);
      return json(res, 200, { ok: true, status: rec.status });
    }

    return json(res, 404, { error: 'not found' });
  } catch (e) {
    return json(res, 500, { error: String((e && e.message) || e) });
  }
});

server.listen(PORT, () => console.log(`[license-server] escuchando en :${PORT}`));
