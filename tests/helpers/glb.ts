/**
 * Packs a glTF JSON document and its binary buffer into a GLB 2.0 container (header + JSON chunk + BIN chunk).
 *
 * @param json glTF JSON root (its `buffers[0].byteLength` should match `bin`)
 * @param bin Binary chunk payload
 * @returns GLB `ArrayBuffer`
 */
export function buildGLB(json: object, bin: Uint8Array): ArrayBuffer {
    const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
    const jsonLength = Math.ceil(jsonBytes.byteLength / 4) * 4;
    const binLength = Math.ceil(bin.byteLength / 4) * 4;
    const total = 12 + 8 + jsonLength + 8 + binLength;

    const buffer = new ArrayBuffer(total);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    view.setUint32(0, 0x46546c67, true);
    view.setUint32(4, 2, true);
    view.setUint32(8, total, true);

    view.setUint32(12, jsonLength, true);
    view.setUint32(16, 0x4e4f534a, true);
    bytes.fill(0x20, 20, 20 + jsonLength);
    bytes.set(jsonBytes, 20);

    const binHeader = 20 + jsonLength;
    view.setUint32(binHeader, binLength, true);
    view.setUint32(binHeader + 4, 0x004e4942, true);
    bytes.set(bin, binHeader + 8);
    return buffer;
}

/**
 * Concatenates typed arrays into one 4-byte aligned binary buffer and returns the `bufferViews` describing them.
 *
 * @param parts Typed arrays (or raw bytes) in order
 * @returns The packed bytes and one `{ byteOffset, byteLength }` view per part
 */
export function packBuffers(parts: ArrayBufferView[]): {
    bin: Uint8Array;
    views: { buffer: number; byteOffset: number; byteLength: number }[];
} {
    const views: { buffer: number; byteOffset: number; byteLength: number }[] = [];
    let offset = 0;
    for (const part of parts) {
        views.push({ buffer: 0, byteOffset: offset, byteLength: part.byteLength });
        offset += Math.ceil(part.byteLength / 4) * 4;
    }
    const bin = new Uint8Array(offset);
    parts.forEach((part, i) => {
        bin.set(new Uint8Array(part.buffer, part.byteOffset, part.byteLength), views[i].byteOffset);
    });
    return { bin, views };
}
