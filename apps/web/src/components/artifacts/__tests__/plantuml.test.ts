import { describe, expect, it } from 'vitest';
import { inflateRawSync } from 'zlib';
import { encode64, encodeHex, encodePlantUml, plantUmlSvgUrl } from '../plantuml';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';

/** Reverse of encode64, to check the round trip */
function decode64(text: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < text.length; i += 4) {
    const [c1, c2, c3, c4] = Array.from(text.slice(i, i + 4)).map(ch => ALPHABET.indexOf(ch));
    out.push((c1 << 2) | (c2 >> 4), ((c2 & 0xf) << 4) | (c3 >> 2), ((c3 & 0x3) << 6) | c4);
  }
  return new Uint8Array(out);
}

describe('PlantUML encoding', () => {
  const source = '@startuml\nclass Order {\n  +placeOrder()\n}\nOrder --> "1..*" OrderLine : Đặt hàng\n@enduml';

  it('deflates and encodes with the PlantUML alphabet (round trip)', async () => {
    const encoded = await encodePlantUml(source);
    expect(encoded).toMatch(/^[0-9A-Za-z_-]+$/);
    expect(inflateRawSync(Buffer.from(decode64(encoded))).toString('utf8')).toBe(source);
  });

  it('encodes 3 bytes into 4 characters', () => {
    expect(encode64(new Uint8Array([0, 0, 0]))).toBe('0000');
    expect(encode64(new Uint8Array([255, 255, 255]))).toBe('____');
  });

  it('has a hex fallback', () => {
    expect(encodeHex('Ab')).toBe('~h4162');
  });

  it('builds the SVG URL, or none when rendering is off', async () => {
    expect(await plantUmlSvgUrl('@startuml\n@enduml', 'https://uml.example/plantuml')).toMatch(/^https:\/\/uml\.example\/plantuml\/svg\/[0-9A-Za-z_-]+$/);
    expect(await plantUmlSvgUrl('@startuml\n@enduml', null)).toBeNull();
  });
});
