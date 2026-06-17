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
// Etiquetas de PC (IP -> nombre que le pone el admin)
// ---------------------------------------------------------------------------
// En la LAN no-steam el uniqueid no distingue maquinas (todas comparten
// STEAM_ID_LAN / HLTV), pero la IP LAN si es unica por PC. Guardamos un mapa
// IP->etiqueta en disco para identificar cada puesto y poder armar los equipos.
// Nota: si el DHCP reparte otra IP en un arranque posterior, la etiqueta puede
// quedar en la PC equivocada y hay que reasignar (ok para un torneo de un dia).
// Cada entrada es { label, group }: label = nombre del puesto (unico por PC),
// group = fila/grupo (compartido, sirve para asignar el equipo de toda la fila).
const LABELS_FILE = path.join(__dirname, 'pc-labels.json');
let pcLabels = {};
try { pcLabels = JSON.parse(fs.readFileSync(LABELS_FILE, 'utf8')); } catch (_) { pcLabels = {}; }
// migracion del formato viejo (string suelto -> { label }):
for (const ip of Object.keys(pcLabels)) {
  if (typeof pcLabels[ip] === 'string') pcLabels[ip] = { label: pcLabels[ip] };
}
function saveLabels() {
  try { fs.writeFileSync(LABELS_FILE, JSON.stringify(pcLabels, null, 2)); }
  catch (e) { console.error('[labels] no se pudo guardar ' + LABELS_FILE + ': ' + e.message); }
}
function labelEntry(ip) {
  const v = ip && pcLabels[ip];
  if (!v) return { label: null, group: null };
  return { label: v.label || null, group: v.group || null };
}
const isValidIp = (s) => /^\d{1,3}(\.\d{1,3}){3}$/.test(String(s || ''));
const cleanLabel = (s, max) => String(s == null ? '' : s).replace(/[\r\n\t]/g, ' ').trim().slice(0, max);

// ---------------------------------------------------------------------------
// Estadisticas (contador por fuera del juego: rondas + kills/muertes)
// ---------------------------------------------------------------------------
// El plugin expone "amx_md_stats" (lineas MDS|...). El panel lo consulta, muestra
// el marcador del PARTIDO en curso, y va ACUMULANDO el torneo: cuando detecta que
// arranco un match nuevo (el score de rondas bajo), pliega el ultimo snapshot del
// match terminado al acumulado persistido. El "torneo" que se muestra = acumulado
// de matches cerrados + el partido en curso, asi siempre esta en vivo y continuo.
const STATS_FILE = path.join(__dirname, 'stats.json');
let statsCommitted = { players: {}, ct: 0, t: 0, matches: 0 };
try {
  const s = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
  if (s && s.players) statsCommitted = { players: s.players || {}, ct: s.ct || 0, t: s.t || 0, matches: s.matches || 0 };
} catch (_) { /* primera vez: arranca vacio */ }
let statsLast = null; // ultimo snapshot del match en curso (baseline, en memoria)
function saveStats() {
  try { fs.writeFileSync(STATS_FILE, JSON.stringify(statsCommitted, null, 2)); }
  catch (e) { console.error('[stats] no se pudo guardar ' + STATS_FILE + ': ' + e.message); }
}

// Parsea la salida de "amx_md_stats" en { ct, t, players: { authid: {...} } }.
function parseStats(raw) {
  const out = { ct: 0, t: 0, players: {} };
  for (const line of String(raw || '').split('\n')) {
    const f = line.split('|');
    if (f[0] !== 'MDS') continue;
    if (f[1] === 'T') { out.ct = +f[2] || 0; out.t = +f[3] || 0; }
    else if (f[1] === 'TS') {
      // Equipos con nombre + lado ACTUAL (sigue al equipo a traves del swap).
      // ctName/ctSide = equipo que arranco CT (su score es out.ct); idem T.
      out.ctName = (f[2] || '').trim();
      out.ctSide = (f[4] || 'CT').trim();
      out.tName = (f[5] || '').trim();
      out.tSide = (f[7] || 'T').trim();
    }
    else if (f[1] === 'P') {
      const authid = (f[3] || '').trim();
      const key = authid && authid !== 'STEAM_ID_PENDING' ? authid : ('u' + (f[2] || '?'));
      out.players[key] = {
        authid: key, userid: +f[2] || 0,
        kills: +f[4] || 0, deaths: +f[5] || 0,
        team: f[6] || 'UNK', name: f.slice(7).join('|').trim(),
      };
    }
  }
  return out;
}
// Suma el snapshot de un match terminado al acumulado.
function foldStats(acc, snap) {
  acc.ct += snap.ct; acc.t += snap.t; acc.matches += 1;
  for (const id in snap.players) {
    const s = snap.players[id];
    const a = acc.players[id] || (acc.players[id] = { name: s.name, kills: 0, deaths: 0 });
    a.kills += s.kills; a.deaths += s.deaths; if (s.name) a.name = s.name;
  }
}
// Mezcla acumulado + match en curso para la vista de torneo.
function mergeStats(committed, cur) {
  const out = { ct: committed.ct + cur.ct, t: committed.t + cur.t, matches: committed.matches, players: {} };
  const add = (src) => {
    for (const id in src.players) {
      const s = src.players[id];
      const a = out.players[id] || (out.players[id] = { authid: id, name: s.name || '', kills: 0, deaths: 0, team: s.team || null });
      a.kills += s.kills; a.deaths += s.deaths; if (s.name) a.name = s.name; if (s.team) a.team = s.team;
    }
  };
  add(committed); add(cur);
  return out;
}

// ---------------------------------------------------------------------------
// Torneo (equipos con nombre + fixture + tabla de posiciones)
// ---------------------------------------------------------------------------
// El plugin/MySQL guardan resultados genericos por mitad, pero no conocen
// "equipos del torneo" ni una tabla de posiciones. Esta capa vive en el panel:
//   - teams:   los equipos con nombre (y tag corto para el clantag in-game).
//   - matches: el fixture (Equipo A vs Equipo B), con lado inicial, formato,
//              estado y marcador final por equipo.
// La tabla de posiciones se computa al vuelo desde los matches 'done' de grupos.
// Todo se persiste en tournament.json (igual criterio que stats.json / labels).
const TOURNEY_FILE = path.join(__dirname, 'tournament.json');
let tourney = { teams: [], matches: [] };
try {
  const t = JSON.parse(fs.readFileSync(TOURNEY_FILE, 'utf8'));
  if (t && Array.isArray(t.teams) && Array.isArray(t.matches)) tourney = { teams: t.teams, matches: t.matches };
} catch (_) { /* primera vez: arranca vacio */ }
function saveTourney() {
  try { fs.writeFileSync(TOURNEY_FILE, JSON.stringify(tourney, null, 2)); }
  catch (e) { console.error('[tourney] no se pudo guardar ' + TOURNEY_FILE + ': ' + e.message); }
}
let idSeq = 0;
const genId = (p) => p + Date.now().toString(36) + (idSeq++).toString(36);
const teamById = (id) => tourney.teams.find((t) => t.id === id) || null;
// clantag que va in-game: preferimos el tag corto; si no hay, el nombre.
const teamTag = (t) => (t && (t.tag || t.name)) || '';

// Computa la tabla de posiciones de la fase de grupos (round-robin).
// Solo cuenta matches 'done' de fase 'group'. Puntos: victoria 3, empate 1.
// El orden de desempate (Pts > Dif de rondas > Rondas a favor > nombre) es un
// default razonable; los criterios definitivos del torneo se ajustan luego.
function computeStandings() {
  const row = {};
  for (const t of tourney.teams) {
    row[t.id] = { id: t.id, name: t.name, tag: t.tag || '', pj: 0, g: 0, e: 0, p: 0, rf: 0, ra: 0 };
  }
  for (const m of tourney.matches) {
    if (m.status !== 'done' || m.phase !== 'group') continue;
    const A = row[m.teamA], B = row[m.teamB];
    if (!A || !B) continue;
    A.pj++; B.pj++;
    A.rf += m.scoreA; A.ra += m.scoreB;
    B.rf += m.scoreB; B.ra += m.scoreA;
    if (m.winner === m.teamA) { A.g++; B.p++; }
    else if (m.winner === m.teamB) { B.g++; A.p++; }
    else { A.e++; B.e++; }
  }
  const rows = Object.values(row).map((r) => ({ ...r, dif: r.rf - r.ra, pts: r.g * 3 + r.e }));
  rows.sort((a, b) => (b.pts - a.pts) || (b.dif - a.dif) || (b.rf - a.rf) || a.name.localeCompare(b.name));
  return rows;
}

// Comando rcon para arrancar un match del torneo: amx_match <tagCT> <tagT> <fmt> <cfg>.
// sideA indica que lado arranca el equipo A; el CT va primero en el comando.
function startMatchCmd(m) {
  const a = teamById(m.teamA), b = teamById(m.teamB);
  if (!a || !b) throw new Error('El match referencia un equipo que ya no existe');
  const ctTeam = m.sideA === 'ct' ? a : b;
  const tTeam = m.sideA === 'ct' ? b : a;
  const rec = m.rec ? ' recdemo' : '';
  return 'amx_match ' + rconQuote(teamTag(ctTeam)) + ' ' + rconQuote(teamTag(tTeam)) +
    ' ' + cleanArg(m.format) + ' ' + cleanArg(m.config) + rec;
}

// Arranca el match en el server: corre amx_match y LUEGO empuja amx_match_overtime
// segun la FASE. El plugin lee ese cvar EN VIVO al terminar el tiempo regular
// (amx_match_deluxe.sma:1436, no lo cachea al inicio) y nada lo re-ejecuta a mitad
// de match, asi que empujarlo despues del amx_match alcanza y queda firme hasta el
// tie-time (el rcon esta serializado: el 2do comando corre tras la respuesta del 1ro,
// ya pasado el re-exec de amxmd.cfg que dispara amx_match):
//   grupos     -> 0 (empate = se define por puntaje, SIN knife)
//   semi/final -> 1 (empate = knife round de muerte subita)
async function startMatchRcon(m) {
  const out1 = await rcon(startMatchCmd(m));
  const out2 = await rcon('amx_match_overtime ' + (m.phase === 'group' ? 0 : 1));
  return (out1 + '\n' + out2).trim();
}

const VALID_FMT = (s) => /^(mr|tl)\d{1,2}$/.test(String(s || ''));
const VALID_PHASE = (s) => s === 'group' || s === 'semi' || s === 'final';
const VALID_SIDE = (s) => s === 'ct' || s === 't';

// ---------------------------------------------------------------------------
// RCON (GoldSrc, UDP)
// ---------------------------------------------------------------------------
// El RCON de GoldSrc guarda UN solo challenge por IP cliente: si dos handshakes
// se solapan, el segundo pisa al primero y el primero recibe "Bad challenge".
// Serializamos todas las llamadas en una cola (cadena de promesas) para que nunca
// haya mas de un handshake en vuelo — venga del auto-refresh, de un F5 que dejo un
// socket viejo esperando, o de botones apurados.
let rconQueue = Promise.resolve();
function rcon(command) {
  const run = () => rconImpl(command);
  const next = rconQueue.then(run, run); // corre haya fallado o no el anterior
  rconQueue = next.catch(() => {});      // un fallo no debe cortar la cadena
  return next;
}

function rconImpl(command) {
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
    // # <slot> "<name>" <userid> <uniqueid> <frag> <time> <ping> <loss> <adr>
    // El <adr> (IP:puerto) viene al final; lo capturamos opcionalmente para poder
    // banear por IP (mas confiable que por uniqueid en LAN no-steam, ver /api/ban).
    // OJO: el engine alinea el slot en 2 chars, asi que los slots >=10 salen
    // pegados a la # ("#10" sin espacio). Por eso \s* (no \s+) tras la #.
    const m = line.match(/^#\s*(\d+)\s+"(.*)"\s+(\d+)\s+(\S+)\s+(-?\d+)\s+([\d:]+)\s+(\d+)(?:\s+(\d+)\s+(\d{1,3}(?:\.\d{1,3}){3}))?/);
    if (m) {
      out.players.push({
        slot: +m[1], name: m[2], userid: +m[3], uniqueid: m[4],
        frags: +m[5], time: m[6], ping: +m[7], ip: m[9] || null,
      });
    }
  }
  return out;
}

// Parsea la salida de "listid"/"listip" en [{ value, duration }].
// El engine lista cada entrada como "<id-o-ip> : <duracion>" (ej. "permanent" o
// "30.00 min"); el encabezado ("ID filter list: N entries") no lleva " : " con
// espacios alrededor, asi que no matchea y queda afuera.
function parseBanList(raw) {
  const out = [];
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*(\S.*?)\s+:\s+(.+?)\s*$/);
    if (m) out.push({ value: m[1].trim(), duration: m[2].trim() });
  }
  return out;
}

// Limpia un argumento que va directo a la consola rcon: saca comillas, punto y
// coma (separador de comandos), espacios y saltos de linea para evitar inyeccion.
// Deja intactos los caracteres validos de IP (.) y uniqueid (: _ alfanumericos).
function cleanArg(s) {
  return String(s == null ? '' : s).replace(/["'`;\s\r\n]/g, '');
}

// Como cleanArg pero conserva espacios y lo envuelve en comillas: para clantags de
// equipo ("Los Tigres") que van como UN solo argumento a amx_match. Saca comillas,
// punto y coma (separa comandos) y saltos de linea para evitar inyeccion rcon.
function rconQuote(s) {
  return '"' + String(s == null ? '' : s).replace(/["'`;\r\n]/g, '').trim() + '"';
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
        // etiqueta + fila de cada PC por IP (identificacion fisica de la maquina)
        for (const p of parsed.players) {
          const e = labelEntry(p.ip);
          p.label = e.label; p.group = e.group;
        }
        return json(res, 200, { ok: true, ...parsed, raw });
      }

      if (req.method === 'GET' && route === '/api/meta') {
        return json(res, 200, { maps: CONFIG.maps || [], configs: CONFIG.configs || [] });
      }

      // --- label: asigna/borra nombre y/o fila de una PC por su IP (persistido) ---
      // Solo toca los campos presentes en el body (label y/o group); vacio = borra
      // ese campo. Si la PC queda sin label ni group, se elimina del mapa.
      if (req.method === 'POST' && route === '/api/label') {
        const { ip, label, group } = await readBody(req);
        if (!isValidIp(ip)) return json(res, 400, { error: 'IP invalida' });
        const cur = (pcLabels[ip] && typeof pcLabels[ip] === 'object') ? pcLabels[ip] : {};
        if (label !== undefined) { const c = cleanLabel(label, 32); if (c) cur.label = c; else delete cur.label; }
        if (group !== undefined) { const c = cleanLabel(group, 16); if (c) cur.group = c; else delete cur.group; }
        if (cur.label || cur.group) pcLabels[ip] = cur; else delete pcLabels[ip];
        saveLabels();
        return json(res, 200, { ok: true, ip, label: cur.label || null, group: cur.group || null });
      }

      // --- stats: marcador del partido + acumulado del torneo ---
      if (req.method === 'GET' && route === '/api/stats') {
        const cur = parseStats(await rcon('amx_md_stats'));
        // deteccion de match nuevo: el score de rondas bajo respecto al ultimo
        // snapshot -> el match anterior termino, lo plegamos al acumulado.
        if (statsLast && (statsLast.ct + statsLast.t) > 0 && (cur.ct + cur.t) < (statsLast.ct + statsLast.t)) {
          foldStats(statsCommitted, statsLast);
          saveStats();
        }
        statsLast = cur;
        return json(res, 200, { ok: true, match: cur, tournament: mergeStats(statsCommitted, cur) });
      }

      // --- stats/reset: borra el acumulado del torneo (el partido sigue en vivo) ---
      if (req.method === 'POST' && route === '/api/stats/reset') {
        statsCommitted = { players: {}, ct: 0, t: 0, matches: 0 };
        saveStats();
        return json(res, 200, { ok: true });
      }

      // --- torneo: estado completo (equipos + fixture + tabla de posiciones) ---
      if (req.method === 'GET' && route === '/api/tournament') {
        return json(res, 200, { ok: true, teams: tourney.teams, matches: tourney.matches, standings: computeStandings() });
      }

      // --- torneo: crear o editar un equipo ---
      // Sin id => crea uno nuevo. Con id => edita ese (nombre / tag).
      if (req.method === 'POST' && route === '/api/tournament/team') {
        const { id, name, tag } = await readBody(req);
        const nm = cleanLabel(name, 32);
        if (!nm) return json(res, 400, { error: 'Falta el nombre del equipo' });
        const tg = cleanLabel(tag, 15);
        if (id) {
          const t = teamById(id);
          if (!t) return json(res, 404, { error: 'Equipo no encontrado' });
          t.name = nm; t.tag = tg;
        } else {
          tourney.teams.push({ id: genId('eq_'), name: nm, tag: tg });
        }
        saveTourney();
        return json(res, 200, { ok: true, teams: tourney.teams });
      }

      // --- torneo: borrar un equipo (rechaza si tiene matches asociados) ---
      if (req.method === 'POST' && route === '/api/tournament/team/delete') {
        const { id } = await readBody(req);
        const used = tourney.matches.some((m) => m.teamA === id || m.teamB === id);
        if (used) return json(res, 400, { error: 'No se puede borrar: el equipo tiene matches en el fixture. Borra esos matches primero.' });
        const before = tourney.teams.length;
        tourney.teams = tourney.teams.filter((t) => t.id !== id);
        if (tourney.teams.length === before) return json(res, 404, { error: 'Equipo no encontrado' });
        saveTourney();
        return json(res, 200, { ok: true, teams: tourney.teams });
      }

      // --- torneo: crear un match (y opcionalmente arrancarlo en el server) ---
      if (req.method === 'POST' && route === '/api/tournament/match') {
        const b = await readBody(req);
        if (!teamById(b.teamA) || !teamById(b.teamB)) return json(res, 400, { error: 'Equipo A o B invalido' });
        if (b.teamA === b.teamB) return json(res, 400, { error: 'Un equipo no puede jugar contra si mismo' });
        if (!VALID_PHASE(b.phase)) return json(res, 400, { error: 'Fase invalida' });
        if (!VALID_SIDE(b.sideA)) return json(res, 400, { error: 'Lado inicial invalido' });
        if (!VALID_FMT(b.format)) return json(res, 400, { error: 'Formato invalido (ej. mr10, mr12)' });
        const m = {
          id: genId('m_'), teamA: b.teamA, teamB: b.teamB, sideA: b.sideA,
          phase: b.phase, format: b.format, config: cleanArg(b.config) || 'cal',
          rec: !!b.rec, status: 'pending', scoreA: 0, scoreB: 0, winner: null,
          createdAt: new Date().toISOString(), closedAt: null,
        };
        tourney.matches.push(m);
        let output = null;
        if (b.start) {
          output = await startMatchRcon(m);
          m.status = 'live';
        }
        saveTourney();
        return json(res, 200, { ok: true, match: m, output, matches: tourney.matches });
      }

      // --- torneo: arrancar en el server un match ya creado ---
      if (req.method === 'POST' && route === '/api/tournament/match/start') {
        const { id } = await readBody(req);
        const m = tourney.matches.find((x) => x.id === id);
        if (!m) return json(res, 404, { error: 'Match no encontrado' });
        const output = await startMatchRcon(m);
        m.status = 'live';
        saveTourney();
        return json(res, 200, { ok: true, match: m, output });
      }

      // --- torneo: cerrar un match con su marcador final por equipo ---
      // El admin confirma scoreA/scoreB (prerellenados con el score en vivo). El
      // ganador se deriva del marcador; empate posible en grupos (MR sin OT).
      if (req.method === 'POST' && route === '/api/tournament/match/close') {
        const { id, scoreA, scoreB } = await readBody(req);
        const m = tourney.matches.find((x) => x.id === id);
        if (!m) return json(res, 404, { error: 'Match no encontrado' });
        const sa = Math.max(0, parseInt(scoreA, 10) || 0);
        const sb = Math.max(0, parseInt(scoreB, 10) || 0);
        m.scoreA = sa; m.scoreB = sb;
        m.winner = sa > sb ? m.teamA : (sb > sa ? m.teamB : 'draw');
        m.status = 'done';
        m.closedAt = new Date().toISOString();
        saveTourney();
        return json(res, 200, { ok: true, match: m, standings: computeStandings() });
      }

      // --- torneo: reabrir un match cerrado (vuelve a pending, no borra el score) ---
      if (req.method === 'POST' && route === '/api/tournament/match/reopen') {
        const { id } = await readBody(req);
        const m = tourney.matches.find((x) => x.id === id);
        if (!m) return json(res, 404, { error: 'Match no encontrado' });
        m.status = 'pending'; m.winner = null; m.closedAt = null;
        saveTourney();
        return json(res, 200, { ok: true, match: m, standings: computeStandings() });
      }

      // --- torneo: borrar un match del fixture ---
      if (req.method === 'POST' && route === '/api/tournament/match/delete') {
        const { id } = await readBody(req);
        const before = tourney.matches.length;
        tourney.matches = tourney.matches.filter((x) => x.id !== id);
        if (tourney.matches.length === before) return json(res, 404, { error: 'Match no encontrado' });
        saveTourney();
        return json(res, 200, { ok: true, matches: tourney.matches, standings: computeStandings() });
      }

      // --- torneo: score de rondas en vivo (para prerellenar el cierre) ---
      if (req.method === 'GET' && route === '/api/tournament/livescore') {
        const cur = parseStats(await rcon('amx_md_stats'));
        return json(res, 200, { ok: true, ct: cur.ct, t: cur.t });
      }

      // --- bans: lista los baneos activos del engine (por IP y por uniqueid) ---
      if (req.method === 'GET' && route === '/api/bans') {
        const idsRaw = await rcon('listid');
        const ipsRaw = await rcon('listip');
        return json(res, 200, {
          ok: true,
          ips: parseBanList(ipsRaw),
          ids: parseBanList(idsRaw),
          raw: { ids: idsRaw, ips: ipsRaw },
        });
      }

      // --- ban: banea por IP (addip) o por uniqueid (banid) y lo persiste ---
      // En LAN no-steam conviene banear por IP: muchos clientes comparten el mismo
      // uniqueid (STEAM_ID_LAN / HLTV), asi que un banid podria afectar a varios.
      // minutes 0 = permanente. writeip/writeid graban el ban a disco (sobrevive al
      // reinicio del server). addip no kickea solo, asi que mandamos kick aparte.
      if (req.method === 'POST' && route === '/api/ban') {
        const { type, value, minutes, userid } = await readBody(req);
        const val = cleanArg(value);
        if (!val) return json(res, 400, { error: 'Falta el valor a banear (IP o ID)' });
        const min = Math.max(0, parseInt(minutes, 10) || 0);
        const uid = parseInt(userid, 10);
        let out = '';
        if (type === 'ip') {
          out += await rcon('addip ' + min + ' ' + val) + '\n';
          if (Number.isInteger(uid) && uid > 0) out += await rcon('kick #' + uid) + '\n';
          out += await rcon('writeip');
        } else if (type === 'id') {
          out += await rcon('banid ' + min + ' ' + val + ' kick') + '\n';
          out += await rcon('writeid');
        } else {
          return json(res, 400, { error: 'type debe ser "ip" o "id"' });
        }
        return json(res, 200, { ok: true, output: out.trim() });
      }

      // --- unban: quita un baneo (removeip / removeid) y lo persiste ---
      if (req.method === 'POST' && route === '/api/unban') {
        const { type, value } = await readBody(req);
        const val = cleanArg(value);
        if (!val) return json(res, 400, { error: 'Falta el valor a desbanear' });
        let out = '';
        if (type === 'ip') {
          out += await rcon('removeip ' + val) + '\n';
          out += await rcon('writeip');
        } else if (type === 'id') {
          out += await rcon('removeid ' + val) + '\n';
          out += await rcon('writeid');
        } else {
          return json(res, 400, { error: 'type debe ser "ip" o "id"' });
        }
        return json(res, 200, { ok: true, output: out.trim() });
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
