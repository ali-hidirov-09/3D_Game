/**
 * VOID HUNTER — WebSocket Relay Server
 * 
 * Run:   node relay-server.js
 * Needs: npm install ws
 * 
* Each message is broadcast to all connected players globally. * Special types handled: join, pos, shoot, hit_enemy, kill_enemy,
 *   hit_boss, kill_boss, pkg_collect, shop_ready, boss_aura, wave_state
 */

const { WebSocketServer } = require('ws');
const PORT = 8080;

const wss = new WebSocketServer({ port: PORT });
const clients = new Map(); // id -> { ws, name, color }
let nextId = 1;

console.log(`[VOID RELAY] Listening on ws://localhost:${PORT}`);

wss.on('connection', (ws) => {
  const id = String(nextId++);
  clients.set(id, { ws, name: 'PLAYER_' + id, color: null });
  console.log(`[+] Client ${id} connected. Total: ${clients.size}`);

  // Send welcome
  ws.send(JSON.stringify({ type: 'welcome', id }));

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    msg.id = id; // Stamp sender id

    // Handle join: record name, then announce to others
    if (msg.type === 'join') {
      clients.get(id).name = msg.name || ('GHOST_' + id);
      broadcast(id, { type: 'peer_join', id, name: clients.get(id).name });
      return;
    }

    // For pos: re-emit as peer_pos so receivers know it's remote
    if (msg.type === 'pos') {
      broadcast(id, { type: 'peer_pos', id, x: msg.x, y: msg.y, z: msg.z, yaw: msg.yaw, hp: msg.hp });
      return;
    }

    // For shoot: re-emit as peer_shoot
    if (msg.type === 'shoot') {
      broadcast(id, { type: 'peer_shoot', id, ox: msg.ox, oy: msg.oy, oz: msg.oz, dx: msg.dx, dy: msg.dy, dz: msg.dz });
      return;
    }

    // All other types: forward verbatim to everyone else
    broadcast(id, msg);
  });

  ws.on('close', () => {
    clients.delete(id);
    broadcast(null, { type: 'peer_leave', id });
    console.log(`[-] Client ${id} left. Total: ${clients.size}`);
  });

  ws.on('error', (e) => console.error(`[!] Client ${id} error:`, e.message));
});

function broadcast(senderId, msg) {
  const data = JSON.stringify(msg);
  clients.forEach(({ ws }, cid) => {
    if (cid !== senderId && ws.readyState === 1) {
      ws.send(data);
    }
  });
}
