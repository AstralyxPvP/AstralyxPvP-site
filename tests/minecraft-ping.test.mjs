import assert from 'node:assert/strict';
import { Duplex } from 'node:stream';
import test from 'node:test';
import {
  getMotdText,
  pingMinecraftServer,
  resolveMinecraftSrv
} from '../status-monitor-worker/src/minecraft-ping.js';

function encodeVarInt(value) {
  const bytes = [];
  let rest = value;
  do {
    let byte = rest & 0x7f;
    rest >>>= 7;
    if (rest) byte |= 0x80;
    bytes.push(byte);
  } while (rest);
  return bytes;
}

function mockSocket(status, captures) {
  const json = new TextEncoder().encode(JSON.stringify(status));
  const packet = new Uint8Array([
    ...encodeVarInt(1 + encodeVarInt(json.length).length + json.length),
    0,
    ...encodeVarInt(json.length),
    ...json
  ]);
  const readable = new ReadableStream({
    start(controller) {
      controller.enqueue(packet.slice(0, 3));
      controller.enqueue(packet.slice(3));
      controller.close();
    }
  });
  const writable = new WritableStream({
    write(chunk) {
      captures.push(new Uint8Array(chunk));
    }
  });
  return {
    opened: Promise.resolve(),
    readable,
    writable,
    close() {}
  };
}

test('Java status ping sends handshake and parses a split status response', async () => {
  const status = {
    version: { name: '1.21.1', protocol: 767 },
    players: { online: 12, max: 100 },
    description: { text: 'Welcome ', extra: [{ text: 'to Astralyx' }] }
  };
  const writes = [];
  const result = await pingMinecraftServer({
    hostname: 'proxy.example.test',
    port: 25565,
    serverAddress: 'play.example.test',
    connect: () => mockSocket(status, writes)
  });

  assert.deepEqual(result, status);
  assert.equal(writes.length, 1);
  assert.ok(new TextDecoder().decode(writes[0]).includes('play.example.test'));
  assert.equal(getMotdText(result.description), 'Welcome to Astralyx');
});

test('SRV resolution picks the lowest-priority valid Minecraft target', async () => {
  const calls = [];
  const result = await resolveMinecraftSrv('play.example.test', async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify({
      Answer: [
        { data: '5 100 25566 backup.example.test.' },
        { data: '0 10 25565 primary.example.test.' }
      ]
    }), { status: 200 });
  });

  assert.deepEqual(result, { priority: 0, weight: 10, port: 25565, hostname: 'primary.example.test' });
  assert.match(calls[0].url, /name=_minecraft/);
  assert.equal(calls[0].options.headers.Accept, 'application/dns-json');
});

test('Minecraft ping reports an invalid host configuration', async () => {
  await assert.rejects(() => pingMinecraftServer({
    hostname: '',
    port: 25565,
    connect: () => mockSocket({}, [])
  }), /valid Minecraft host/);
});
