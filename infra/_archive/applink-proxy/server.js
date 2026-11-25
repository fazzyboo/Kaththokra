'use strict';
// Kaththokra — Applink proxy
// Runs on a server with a fixed public IP (the IP you whitelist in Applink).
// Your Vercel backend calls this proxy; the proxy forwards the JSON POST to
// https://api.applink.com.bd/<path> so Applink sees the request coming from the static IP.
// No dependencies: needs Node 18+ (built-in fetch).

const http = require('node:http');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '127.0.0.1'; // Caddy (HTTPS) sits in front of this
const SECRET = process.env.PROXY_SECRET || '';
const APPLINK_BASE = (process.env.APPLINK_BASE || 'https://api.applink.com.bd').replace(/\/+$/, '');
const TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS || 25000);
const MAX_BODY = 1024 * 1024; // 1 MB

if (SECRET.length < 24 || SECRET.includes('CHANGE_ME')) {
  console.error('PROXY_SECRET is missing or still the placeholder. Put a random value of 24+ characters in /etc/applink-proxy.env');
  process.exit(1);
}

const secretHash = crypto.createHash('sha256').update(SECRET).digest();
function authorized(req) {
  const given = req.headers['x-proxy-secret'];
  if (typeof given !== 'string') return false;
  const h = crypto.createHash('sha256').update(given).digest();
  return crypto.timingSafeEqual(h, secretHash);
}

// Only paths like /applink/sms/send or /applink/caas/direct/debit are forwarded.
const PATH_RE = /^\/applink\/([A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*)$/;

function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooBig = false;
    req.on('data', (c) => {
      if (tooBig) return; // keep draining so we can still reply
      size += c.length;
      if (size > MAX_BODY) {
        tooBig = true;
        chunks.length = 0;
        reject(Object.assign(new Error('Body too large (max 1 MB)'), { status: 413 }));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => { if (!tooBig) resolve(Buffer.concat(chunks)); });
    req.on('error', reject);
  });
}

// Never log request bodies: they contain the Applink password.
function log(method, path, status, appStatus, ms) {
  console.log(`${new Date().toISOString()} ${method} ${path} -> ${status}${appStatus ? ' ' + appStatus : ''} ${ms}ms`);
}

const server = http.createServer(async (req, res) => {
  const started = Date.now();
  const url = new URL(req.url, 'http://localhost');

  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      return send(res, 200, { ok: true });
    }

    // Shows the IP Applink will see. Open it in a browser to confirm it matches the whitelisted IP.
    if (req.method === 'GET' && url.pathname === '/myip') {
      const r = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(10000) });
      return send(res, 200, await r.json());
    }

    const m = PATH_RE.exec(url.pathname);
    if (!m) return send(res, 404, { statusCode: 'PROXY_NOT_FOUND', statusDetail: 'Use POST /applink/<applink-path>' });
    if (req.method !== 'POST') return send(res, 405, { statusCode: 'PROXY_METHOD', statusDetail: 'Only POST is allowed' });
    if (!authorized(req)) {
      log(req.method, url.pathname, 401, '', Date.now() - started);
      return send(res, 401, { statusCode: 'PROXY_UNAUTHORIZED', statusDetail: 'Missing or wrong x-proxy-secret header' });
    }

    const raw = await readBody(req);
    try {
      JSON.parse(raw.toString('utf8'));
    } catch {
      return send(res, 400, { statusCode: 'PROXY_BAD_JSON', statusDetail: 'Body must be valid JSON' });
    }

    const upstream = await fetch(`${APPLINK_BASE}/${m[1]}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: raw,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = await upstream.text();

    let appStatus = '';
    try { appStatus = JSON.parse(text).statusCode || ''; } catch { /* non-JSON reply */ }
    log(req.method, url.pathname, upstream.status, appStatus, Date.now() - started);

    res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'application/json' });
    res.end(text);
  } catch (err) {
    const status = err.status || 502;
    log(req.method, url.pathname, status, 'PROXY_ERROR', Date.now() - started);
    send(res, status, { statusCode: 'PROXY_ERROR', statusDetail: String(err.message || err) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Applink proxy listening on ${HOST}:${PORT}, forwarding to ${APPLINK_BASE}`);
});
