'use strict';
// Herramienta rcon de linea de comando (diagnostico). Usa la misma config que el panel.
//   node rcon-test.js "sv_lan"
//   node rcon-test.js "status"
const dgram = require('dgram');
const fs = require('fs');
const path = require('path');
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const HEADER = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]);

function rcon(command) {
  return new Promise((resolve, reject) => {
    const sock = dgram.createSocket('udp4');
    let challenge = null, output = '', t = null, hard = null;
    const end = () => { clearTimeout(t); clearTimeout(hard); try { sock.close(); } catch (_) {} resolve(output.trim()); };
    const fail = (m) => { clearTimeout(t); clearTimeout(hard); try { sock.close(); } catch (_) {} reject(new Error(m)); };
    sock.on('error', (e) => fail(e.message));
    sock.on('message', (msg) => {
      const body = msg.slice(4);
      if (challenge === null) {
        const m = body.toString('latin1').match(/challenge rcon (-?\d+)/);
        if (!m) return;
        challenge = m[1];
        sock.send(Buffer.concat([HEADER, Buffer.from(`rcon ${challenge} "${CONFIG.rconPassword}" ${command}\n`, 'latin1')]), CONFIG.gamePort, CONFIG.gameHost);
        clearTimeout(t); t = setTimeout(end, 600);
        return;
      }
      output += body.slice(1).toString('latin1');
      clearTimeout(t); t = setTimeout(end, 150);
    });
    sock.send(Buffer.concat([HEADER, Buffer.from('challenge rcon\n', 'latin1')]), CONFIG.gamePort, CONFIG.gameHost);
    hard = setTimeout(() => fail('Timeout: sin respuesta de ' + CONFIG.gameHost + ':' + CONFIG.gamePort), 2500);
  });
}

(async () => {
  const cmd = process.argv.slice(2).join(' ') || 'status';
  console.log(`>>> rcon (${CONFIG.gameHost}:${CONFIG.gamePort}): ${cmd}\n`);
  try { console.log(await rcon(cmd)); }
  catch (e) { console.log('[ERROR] ' + e.message); }
})();
