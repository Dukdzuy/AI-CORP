/**
 * PlantUML server URL encoding: deflate (raw) + PlantUML's own base64 alphabet,
 * see https://plantuml.com/text-encoding. Falls back to the "~h" hex form when the
 * browser has no CompressionStream.
 */
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';

export function encode64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b3 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += ALPHABET[b1 >> 2];
    out += ALPHABET[((b1 & 0x3) << 4) | (b2 >> 4)];
    out += ALPHABET[((b2 & 0xf) << 2) | (b3 >> 6)];
    out += ALPHABET[b3 & 0x3f];
  }
  return out;
}

export function encodeHex(source: string): string {
  return '~h' + Array.from(new TextEncoder().encode(source), b => b.toString(16).padStart(2, '0')).join('');
}

async function deflateRaw(source: string): Promise<Uint8Array> {
  const stream = new Blob([source]).stream().pipeThrough(new CompressionStream('deflate-raw' as CompressionFormat));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function encodePlantUml(source: string): Promise<string> {
  if (typeof CompressionStream === 'undefined') return encodeHex(source);
  try {
    return encode64(await deflateRaw(source));
  } catch {
    return encodeHex(source);
  }
}

/** Server from VITE_PLANTUML_SERVER; an empty value turns rendering off (source view only) */
export function plantUmlServer(): string | null {
  const configured = import.meta.env?.VITE_PLANTUML_SERVER as string | undefined;
  if (configured === '') return null;
  return (configured || 'https://www.plantuml.com/plantuml').replace(/\/+$/, '');
}

export async function plantUmlSvgUrl(source: string, server = plantUmlServer()): Promise<string | null> {
  if (!server) return null;
  return `${server}/svg/${await encodePlantUml(source)}`;
}
