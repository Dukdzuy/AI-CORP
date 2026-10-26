import { deflateRawSync } from 'zlib';

interface ZipEntry {
  name: Buffer;
  crc: number;
  compressed: Buffer;
  size: number;
  method: 0 | 8;
  dosTime: number;
  dosDate: number;
  offset: number;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * ZipWriter
 *
 * Minimal ZIP (PKWARE APPNOTE 2.0) writer for downloading a generated project: deflate or
 * store per entry, UTF-8 names, no ZIP64 (generated projects are far below 4 GB / 65k files).
 * Kept dependency-free because the archive is built in memory from ProjectWorkspace files.
 *
 * @pattern Builder
 */
export class ZipWriter {
  private readonly entries: ZipEntry[] = [];
  private readonly chunks: Buffer[] = [];
  private offset = 0;

  addFile(name: string, data: Buffer, modifiedAt: Date = new Date()): this {
    const clean = name.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!clean || clean.split('/').includes('..')) {
      throw new Error(`Unsafe zip entry name: ${name}`);
    }
    const deflated = deflateRawSync(data);
    const useDeflate = deflated.length < data.length;
    const compressed = useDeflate ? deflated : data;
    const { dosTime, dosDate } = ZipWriter.dosDateTime(modifiedAt);
    const entry: ZipEntry = {
      name: Buffer.from(clean, 'utf8'),
      crc: crc32(data),
      compressed,
      size: data.length,
      method: useDeflate ? 8 : 0,
      dosTime,
      dosDate,
      offset: this.offset,
    };

    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); // local file header signature
    header.writeUInt16LE(20, 4); // version needed
    header.writeUInt16LE(0x0800, 6); // flags: UTF-8 names
    header.writeUInt16LE(entry.method, 8);
    header.writeUInt16LE(entry.dosTime, 10);
    header.writeUInt16LE(entry.dosDate, 12);
    header.writeUInt32LE(entry.crc, 14);
    header.writeUInt32LE(entry.compressed.length, 18);
    header.writeUInt32LE(entry.size, 22);
    header.writeUInt16LE(entry.name.length, 26);
    header.writeUInt16LE(0, 28); // extra length

    this.push(header, entry.name, entry.compressed);
    this.entries.push(entry);
    return this;
  }

  get size(): number {
    return this.entries.length;
  }

  toBuffer(): Buffer {
    const centralStart = this.offset;
    const central: Buffer[] = [];
    for (const e of this.entries) {
      const header = Buffer.alloc(46);
      header.writeUInt32LE(0x02014b50, 0); // central directory signature
      header.writeUInt16LE(20, 4); // version made by
      header.writeUInt16LE(20, 6); // version needed
      header.writeUInt16LE(0x0800, 8);
      header.writeUInt16LE(e.method, 10);
      header.writeUInt16LE(e.dosTime, 12);
      header.writeUInt16LE(e.dosDate, 14);
      header.writeUInt32LE(e.crc, 16);
      header.writeUInt32LE(e.compressed.length, 20);
      header.writeUInt32LE(e.size, 24);
      header.writeUInt16LE(e.name.length, 28);
      // extra, comment, disk start, internal attributes: 0
      header.writeUInt32LE(0, 38); // external attributes
      header.writeUInt32LE(e.offset, 42);
      central.push(header, e.name);
    }
    const centralSize = central.reduce((n, b) => n + b.length, 0);

    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); // end of central directory signature
    end.writeUInt16LE(this.entries.length, 8);
    end.writeUInt16LE(this.entries.length, 10);
    end.writeUInt32LE(centralSize, 12);
    end.writeUInt32LE(centralStart, 16);

    return Buffer.concat([...this.chunks, ...central, end]);
  }

  private push(...buffers: Buffer[]): void {
    for (const b of buffers) {
      this.chunks.push(b);
      this.offset += b.length;
    }
  }

  private static dosDateTime(date: Date): { dosTime: number; dosDate: number } {
    const year = Math.max(1980, date.getFullYear());
    return {
      dosTime: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
      dosDate: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    };
  }
}
