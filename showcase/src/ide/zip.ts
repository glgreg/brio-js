// Minimal zip support for project export/import, with no dependencies.
// Writing uses the "stored" method (no compression: game assets are already compressed); reading accepts stored
// and deflated entries (DecompressionStream "deflate-raw"), which covers zips made by common tools.

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c >>> 0;
    }
    return table;
})();

function crc32(data: Uint8Array): number {
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
    path: string;
    data: Uint8Array;
}

export function writeZip(entries: ZipEntry[]): Blob {
    const encoder = new TextEncoder();
    const parts: BlobPart[] = [];
    const central: Uint8Array[] = [];
    let offset = 0;
    const now = new Date();
    const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    for (const entry of entries) {
        const name = encoder.encode(entry.path);
        const crc = crc32(entry.data);
        const local = new DataView(new ArrayBuffer(30));
        local.setUint32(0, 0x04034b50, true);
        local.setUint16(4, 20, true);
        local.setUint16(6, 0x0800, true); // UTF-8 names
        local.setUint16(8, 0, true);
        local.setUint16(10, time, true);
        local.setUint16(12, date, true);
        local.setUint32(14, crc, true);
        local.setUint32(18, entry.data.length, true);
        local.setUint32(22, entry.data.length, true);
        local.setUint16(26, name.length, true);
        local.setUint16(28, 0, true);
        parts.push(local.buffer, name, entry.data as BlobPart);
        const head = new DataView(new ArrayBuffer(46));
        head.setUint32(0, 0x02014b50, true);
        head.setUint16(4, 20, true);
        head.setUint16(6, 20, true);
        head.setUint16(8, 0x0800, true);
        head.setUint16(10, 0, true);
        head.setUint16(12, time, true);
        head.setUint16(14, date, true);
        head.setUint32(16, crc, true);
        head.setUint32(20, entry.data.length, true);
        head.setUint32(24, entry.data.length, true);
        head.setUint16(28, name.length, true);
        head.setUint32(42, offset, true);
        const record = new Uint8Array(46 + name.length);
        record.set(new Uint8Array(head.buffer), 0);
        record.set(name, 46);
        central.push(record);
        offset += 30 + name.length + entry.data.length;
    }
    const centralSize = central.reduce((n, c) => n + c.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, entries.length, true);
    end.setUint16(10, entries.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, offset, true);
    return new Blob([...parts, ...(central as BlobPart[]), end.buffer], { type: "application/zip" });
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
    const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function readZip(blob: Blob): Promise<ZipEntry[]> {
    const buffer = new Uint8Array(await blob.arrayBuffer());
    const view = new DataView(buffer.buffer);
    let endOffset = -1;
    for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
        if (view.getUint32(i, true) === 0x06054b50) {
            endOffset = i;
            break;
        }
    }
    if (endOffset < 0) throw new Error("Not a zip file");
    const count = view.getUint16(endOffset + 10, true);
    let pointer = view.getUint32(endOffset + 16, true);
    const decoder = new TextDecoder();
    const entries: ZipEntry[] = [];
    for (let i = 0; i < count; i++) {
        if (view.getUint32(pointer, true) !== 0x02014b50) throw new Error("Corrupt zip directory");
        const method = view.getUint16(pointer + 10, true);
        const compressed = view.getUint32(pointer + 20, true);
        const nameLength = view.getUint16(pointer + 28, true);
        const extraLength = view.getUint16(pointer + 30, true);
        const commentLength = view.getUint16(pointer + 32, true);
        const localOffset = view.getUint32(pointer + 42, true);
        const path = decoder.decode(buffer.subarray(pointer + 46, pointer + 46 + nameLength));
        pointer += 46 + nameLength + extraLength + commentLength;
        if (path.endsWith("/")) continue;
        const localName = view.getUint16(localOffset + 26, true);
        const localExtra = view.getUint16(localOffset + 28, true);
        const start = localOffset + 30 + localName + localExtra;
        const raw = buffer.subarray(start, start + compressed);
        if (method === 0) entries.push({ path, data: raw.slice() });
        else if (method === 8) entries.push({ path, data: await inflateRaw(raw) });
        else throw new Error(`Unsupported zip method ${method} for ${path}`);
    }
    return entries;
}
