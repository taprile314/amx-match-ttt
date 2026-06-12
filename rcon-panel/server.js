'use strict';

// Panel de control web para el server de CS 1.6 (HLDS / GoldSrc) via RCON.
// Cero dependencias: usa solo modulos nativos de Node (http, dgram, crypto, fs).
// El protocolo RCON de GoldSrc es por UDP (a diferencia de Source que es TCP):
//   1) pedir challenge:  \xFF\xFF\xFF\xFF "challenge rcon\n"
//   2) mandar comando:   \xFF\xFF\xFF\xFF rcon <challenge> "<pass>" <cmd>\n
//   3) leer la salida (puede venir en varios paquetes).

const http = require('http');
const dgram = require('dgram');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const PUBLIC_DIR = path.join(__dirname, 'public');
const HEADER = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]);

// ---------------------------------------------------------------------------
// RCON (GoldSrc, UDP)
// ---------------------------------------------------------------------------
function rcon(command) {
  console.log('[rcon ' + new Date().toISOString() + '] -> ' + command); // log de auditoria de comandos
  return new Promise((resolve, reject) => {
    const sock = dgram.createSocket('udp4');
    let challenge = null;
    let output = '';
    let collectTimer = null;
    let hardTimer = null;

    const cleanup = () => {
      clearTimeout(collectTimer);
      clearTimeout(hardTimer);
      try { sock.close(); } catch (_) { /* noop */ }
    };
    const done = () => { cleanup(); resolve(output.trim()); };
    const fail = (msg) => { cleanup(); reject(new Error(msg)); };

    sock.on('error', (e) => fail('Socket UDP: ' + e.message));

    sock.on('message', (msg) => {
      const body = msg.slice(4); // descartar los 4 bytes 0xFF
      if (challenge === null) {
        const text = body.toString('latin1');
        const m = text.match(/challenge rcon (-?\d+)/);
        if (!m) return;
        challenge = m[1];
        const cmd = Buffer.concat([
          HEADER,
          Buffer.from(`rcon ${challenge} "${CONFIG.rconPassword}" ${command}\n`, 'latin1'),
        ]);
        sock.send(cmd, CONFIG.gamePort, CONFIG.gameHost, (e) => { if (e) fail('Envio cmd: ' + e.message); });
        // a partir de aca esperamos la salida; si nada llega en 600ms, terminamos
        clearTimeout(collectTimer);
        collectTimer = setTimeout(done, 600);
        return;
      }
      // paquetes de respuesta: el 1er byte tras el header es el tipo ('l'/0x6C)
      output += body.slice(1).toString('latin1');
      clearTimeout(collectTimer);
      collectTimer = setTimeout(done, 150); // junta multiples paquetes
    });

    const chal = Buffer.concat([HEADER, Buffer.from('challenge rcon\n', 'latin1')]);
    sock.send(chal, CONFIG.gamePort, CONFIG.gameHost, (e) => { if (e) fail('Envio challenge: ' + e.message); });

    hardTimer = setTimeout(
      () => fail('Timeout: el server no respondio. ¿hlds corriendo en ' + CONFIG.gameHost + ':' + CONFIG.gamePort + '? ¿rcon_password correcto?'),
      2500
    );
  });
}

// Parsea la salida de "status" en { map, players: [...] }
function parseStatus(raw) {
  const out = { map: null, playerCount: null, maxPlayers: null, players: [] };
  const mapM = raw.match(/^map\s*:\s*(\S+)/m);
  if (mapM) out.map = mapM[1];
  const plM = raw.match(/players\s*:\s*(\d+)\s*active\s*\((\d+)\s*max\)/i);
  if (plM) { out.playerCount = +plM[1]; out.maxPlayers = +plM[2]; }
  const lines = raw.split('\n');
  for (const line of lines) {
    // # <slot> "<name>" <userid> <uniqueid> <frag> <time> <ping> ...
    const m = line.match(/^#\s+(\d+)\s+"(.*)"\s+(\d+)\s+(\S+)\s+(-?\d+)\s+([\d:]+)\s+(\d+)/);
    if (m) {
      out.players.push({
        slot: +m[1], name: m[2], userid: +m[3], uniqueid: m[4],
        frags: +m[5], time: m[6], ping: +m[7],
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Sesiones (token en cookie HttpOnly, en memoria)
// ---------------------------------------------------------------------------
const sessions = new Set();
const COOKIE = 'ttt_sid';

function parseCookies(req) {
  const out = {};
  const h = req.headers.cookie;
  if (!h) return out;
  for (const part of h.split(';')) {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}
function isAuthed(req) {
  const c = parseCookies(req);
  return !!(c[COOKIE] && sessions.has(c[COOKIE]));
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (_) { resolve({}); } });
  });
}
function json(res, code, obj) {
  const s = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(s);
}

const STATIC = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/logo_ttt.png': ['logo_ttt.png', 'image/png'],
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const route = url.pathname;

  try {
    // --- estaticos ---
    if (req.method === 'GET' && STATIC[route]) {
      const [file, type] = STATIC[route];
      const buf = fs.readFileSync(path.join(PUBLIC_DIR, file));
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      return res.end(buf);
    }

    // --- login ---
    if (req.method === 'POST' && route === '/api/login') {
      const { password } = await readBody(req);
      if (password === CONFIG.panelPassword) {
        const token = crypto.randomBytes(24).toString('hex');
        sessions.add(token);
        res.setHeader('Set-Cookie', `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=43200`);
        return json(res, 200, { ok: true });
      }
      return json(res, 401, { ok: false, error: 'Password incorrecta' });
    }

    // --- session check ---
    if (req.method === 'GET' && route === '/api/session') {
      return json(res, 200, { authed: isAuthed(req) });
    }

    // --- logout ---
    if (req.method === 'POST' && route === '/api/logout') {
      const c = parseCookies(req);
      if (c[COOKIE]) sessions.delete(c[COOKIE]);
      res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Path=/; Max-Age=0`);
      return json(res, 200, { ok: true });
    }

    // ----- a partir de aca requiere sesion -----
    if (route.startsWith('/api/')) {
      if (!isAuthed(req)) return json(res, 401, { error: 'No autenticado' });

      if (req.method === 'POST' && route === '/api/rcon') {
        const { cmd } = await readBody(req);
        if (!cmd || typeof cmd !== 'string') return json(res, 400, { error: 'Falta cmd' });
        const out = await rcon(cmd);
        return json(res, 200, { ok: true, output: out });
      }

      if (req.method === 'GET' && route === '/api/status') {
        const raw = await rcon('status');
        const parsed = parseStatus(raw);
        // El "status" del engine no trae el equipo de cada jugador; lo pide al
        // plugin (amx_md_teams -> lineas "MDT|userid|team"). Si el plugin viejo
        // aun no tiene el comando, degradamos: team queda null.
        try {
          const teamsRaw = await rcon('amx_md_teams');
          const byUserid = {};
          for (const line of teamsRaw.split('\n')) {
            const m = line.match(/MDT\|(\d+)\|(CT|T|SPEC|UNK)/);
            if (m) byUserid[+m[1]] = m[2];
          }
          for (const p of parsed.players) {
            p.team = byUserid[p.userid] || null;
          }
        } catch (_) { /* plugin sin amx_md_teams: sin info de equipo */ }
        return json(res, 200, { ok: true, ...parsed, raw });
      }

      if (req.method === 'GET' && route === '/api/meta') {
        return json(res, 200, { maps: CONFIG.maps || [], configs: CONFIG.configs || [] });
      }
    }

    json(res, 404, { error: 'No encontrado' });
  } catch (e) {
    json(res, 500, { error: e.message });
  }
});

server.listen(CONFIG.panelPort, CONFIG.panelHost, () => {
  const shown = CONFIG.panelHost === '0.0.0.0' ? 'localhost (y la IP LAN de esta PC)' : CONFIG.panelHost;
  console.log('========================================================');
  console.log(' Panel de control TTT  ->  http://' + shown + ':' + CONFIG.panelPort);
  console.log(' Server CS objetivo    ->  ' + CONFIG.gameHost + ':' + CONFIG.gamePort + ' (rcon UDP)');
  console.log(' Password del panel     ->  config.json -> panelPassword');
  console.log('========================================================');
  console.log(' Para entrar desde otra PC de la LAN usa la IP de esta maquina,');
  console.log(' ej: http://192.168.1.X:' + CONFIG.panelPort);
  console.log(' Ctrl+C para apagar el panel.');
});
