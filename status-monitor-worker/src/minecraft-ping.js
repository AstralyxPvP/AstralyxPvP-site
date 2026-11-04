function encodeVarInt(value) {
  const bytes = [];
  let remaining = value >>> 0;
  do {
    let byte = remaining & 0x7f;
    remaining >>>= 7;
    if (remaining !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (remaining !== 0);
  return bytes;
}

function readVarInt(bytes, offset) {
  let value = 0;
  let position = offset;
  let byte;
  do {
    if (position >= bytes.length || position - offset >= 5) return null;
    byte = bytes[position++];
    value |= (byte & 0x7f) << ((position - offset - 1) * 7);
  } while ((byte & 0x80) !== 0);
  return { value: value >>> 0, offset: position };
}

function encodePacket(payload) {
  return new Uint8Array([...encodeVarInt(payload.length), ...payload]);
}

function encodeHandshake(hostname, port) {
  const host = new TextEncoder().encode(hostname);
  const packet = [
    ...encodeVarInt(0),
    ...encodeVarInt(768),
    ...encodeVarInt(host.length),
    ...host,
    (port >> 8) & 0xff,
    port & 0xff,
    ...encodeVarInt(1)
  ];
  return encodePacket(packet);
}

function concatBytes(left, right) {
  const result = new Uint8Array(left.length + right.length);
  result.set(left);
  result.set(right, left.length);
  return result;
}

async function readStatus(reader) {
  let buffer = new Uint8Array();
  while (buffer.length < 2 * 1024 * 1024) {
    const { value, done } = await reader.read();
    if (done || !value) throw new Error('Minecraft server closed the status connection early');
    buffer = concatBytes(buffer, value);

    const frameLength = readVarInt(buffer, 0);
    if (!frameLength) continue;
    if (buffer.length < frameLength.offset + frameLength.value) continue;

    const frame = buffer.subarray(frameLength.offset, frameLength.offset + frameLength.value);
    const packetId = readVarInt(frame, 0);
    if (!packetId || packetId.value !== 0) throw new Error('Minecraft server returned an invalid status packet');
    const jsonLength = readVarInt(frame, packetId.offset);
    if (!jsonLength || frame.length < jsonLength.offset + jsonLength.value) {
      throw new Error('Minecraft server returned incomplete status JSON');
    }

    const jsonText = new TextDecoder().decode(frame.subarray(
      jsonLength.offset,
      jsonLength.offset + jsonLength.value
    ));
    const status = JSON.parse(jsonText);
    if (!status || typeof status !== 'object' || !status.players || !status.version) {
      throw new Error('Minecraft server returned an invalid status document');
    }
    return status;
  }
  throw new Error('Minecraft server status packet exceeded the size limit');
}

export async function pingMinecraftServer({
  hostname,
  port,
  serverAddress = hostname,
  connect,
  timeoutMs = 7000
}) {
  if (!hostname || !Number.isInteger(port) || port < 1 || port > 65535 || typeof connect !== 'function') {
    throw new TypeError('A valid Minecraft host, port, and socket connector are required');
  }

  const socket = connect({ hostname, port });
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      try {
        socket.close();
      } catch (error) {
        console.warn('Timed-out Minecraft status socket close failed.', error);
      }
      reject(new Error('Minecraft status ping timed out'));
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      (async () => {
        await socket.opened;
        const writer = socket.writable.getWriter();
        await writer.write(concatBytes(
          encodeHandshake(serverAddress, port),
          encodePacket(encodeVarInt(0))
        ));
        writer.releaseLock();

        const reader = socket.readable.getReader();
        const status = await readStatus(reader);
        reader.releaseLock();
        return status;
      })(),
      timeout
    ]);
  } finally {
    clearTimeout(timeoutId);
    try {
      socket.close();
    } catch (error) {
      console.warn('Minecraft status socket close failed.', error);
    }
  }
}

export async function resolveMinecraftSrv(hostname, fetchImpl = fetch) {
  const url = new URL('https://cloudflare-dns.com/dns-query');
  url.searchParams.set('name', `_minecraft._tcp.${hostname}`);
  url.searchParams.set('type', 'SRV');
  const response = await fetchImpl(url, {
    headers: { Accept: 'application/dns-json' },
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) throw new Error(`Minecraft SRV lookup returned HTTP ${response.status}`);

  const result = await response.json();
  const records = (Array.isArray(result.Answer) ? result.Answer : [])
    .map(answer => {
      const fields = String(answer.data || '').split(/\s+/);
      return {
        priority: Number(fields[0]),
        weight: Number(fields[1]),
        port: Number(fields[2]),
        hostname: fields[3]?.replace(/\.$/, '')
      };
    })
    .filter(record => Number.isInteger(record.port)
      && record.port > 0
      && record.port <= 65535
      && record.hostname);
  records.sort((left, right) => left.priority - right.priority || right.weight - left.weight);
  return records[0] || { hostname, port: 25565 };
}

export function getMotdText(description) {
  if (typeof description === 'string') return description;
  if (!description || typeof description !== 'object') return '';
  if (Array.isArray(description)) return description.map(getMotdText).join('');
  return `${description.text || ''}${Array.isArray(description.extra) ? description.extra.map(getMotdText).join('') : ''}`;
}
