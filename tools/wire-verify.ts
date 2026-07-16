/**
 * End-to-end wire verification — no estimates, the actual thing: spawns the
 * real dedicated server on a spare port, joins with a real ws client, then
 * compares bytes-on-the-socket against decompressed payload bytes to prove
 * permessage-deflate negotiated and report true per-client bandwidth.
 *
 *   npx tsx tools/wire-verify.ts
 */
import { spawn } from 'node:child_process';
import WebSocket from 'ws';

const PORT = 3457;
const SECONDS = 6;

async function main() {
  const server = spawn('npx', ['tsx', 'src/server/server.ts', String(PORT)], {
    shell: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (d) => process.stdout.write('[srv] ' + d));
  server.stderr.on('data', (d) => process.stdout.write('[srv!] ' + d));
  await new Promise((r) => setTimeout(r, 4000)); // let the server bind

  const ws = new WebSocket(`ws://127.0.0.1:${PORT}`, { perMessageDeflate: true });
  let payloadBytes = 0;
  let snaps = 0;
  ws.on('open', () => {
    console.log('negotiated extensions:', JSON.stringify(ws.extensions));
    ws.send(JSON.stringify({ t: 'join', mode: 'conquest', name: 'Probe' }));
  });
  ws.on('message', (raw) => {
    payloadBytes += (raw as Buffer).length;
    if (JSON.parse(String(raw)).t === 'snap') snaps++;
  });

  await new Promise((r) => setTimeout(r, SECONDS * 1000));
  // _socket is internal to ws, but it's the only exact byte counter there is
  const socketBytes = (ws as unknown as { _socket: { bytesRead: number } })._socket.bytesRead;
  console.log(`received ${snaps} snapshots in ${SECONDS}s`);
  console.log(`payload (decompressed): ${(payloadBytes / 1024).toFixed(1)} KB`);
  console.log(`socket (actual wire):   ${(socketBytes / 1024).toFixed(1)} KB`);
  console.log(`compression: ${(payloadBytes / socketBytes).toFixed(1)}x — ${((socketBytes / SECONDS) * 8 / 1000).toFixed(0)} kbps per client on the wire`);
  ws.close();
  server.kill();
  process.exit(0);
}
main();
