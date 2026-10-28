/**
 * Resource limits applied by `GLBLoader`, `GLTFLoader`, and `OBJLoader` while parsing untrusted files, so a
 * hostile or corrupted model fails with a clear error instead of exhausting memory or reading out of bounds.
 */
export interface ModelLoaderLimits {
    /** Maximum size of a fetched model file or companion buffer, in bytes (defaults to 256 MiB). */
    maxFileBytes: number;
    /** Maximum size of the glTF JSON chunk / document, in bytes (defaults to 32 MiB). */
    maxJsonBytes: number;
    /** Maximum number of scalar components one accessor may decode (defaults to 64 Mi = 256 MiB of floats). */
    maxAccessorComponents: number;
    /** Maximum width or height of an embedded or referenced image, in pixels (defaults to 8192). */
    maxImageDimension: number;
    /** Maximum glTF node hierarchy depth (defaults to 128). */
    maxNodeDepth: number;
}

/** Error thrown when a model exceeds a `ModelLoaderLimits` value or references data outside its buffers. */
export class ModelLimitError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ModelLimitError";
    }
}

const DEFAULT_LIMITS: ModelLoaderLimits = {
    maxFileBytes: 256 * 1024 * 1024,
    maxJsonBytes: 32 * 1024 * 1024,
    maxAccessorComponents: 64 * 1024 * 1024,
    maxImageDimension: 8192,
    maxNodeDepth: 128,
};

const activeLimits: ModelLoaderLimits = { ...DEFAULT_LIMITS };

/**
 * Current loader limits (shared by every model loader).
 *
 * @returns Read-only view of the active limits
 */
export function getModelLoaderLimits(): Readonly<ModelLoaderLimits> {
    return activeLimits;
}

/**
 * Overrides some loader limits (e.g. raise `maxImageDimension` for a trusted desktop build), or restores the
 * defaults when called without arguments.
 *
 * @param limits Partial limits to apply
 * @example
 * ```ts
 * configureModelLoaderLimits({ maxFileBytes: 64 * 1024 * 1024, maxImageDimension: 4096 });
 * ```
 */
export function configureModelLoaderLimits(limits?: Partial<ModelLoaderLimits>): void {
    Object.assign(activeLimits, limits ?? DEFAULT_LIMITS);
}

/**
 * Throws a `ModelLimitError` when `byteLength` exceeds `limit`.
 *
 * @param what Description used in the error message
 * @param byteLength Size to check
 * @param limit Maximum size
 */
export function assertByteLimit(what: string, byteLength: number, limit: number): void {
    if (!(byteLength <= limit)) {
        throw new ModelLimitError(`${what} is ${byteLength} bytes, above the ${limit}-byte limit.`);
    }
}

/**
 * Fetches `url` and returns its bytes, rejecting files larger than `maxFileBytes` (checked against
 * `Content-Length` before downloading when the server sends it).
 *
 * @param url Resource URL
 * @param what Description used in error messages
 * @returns The response body
 */
export async function fetchLimited(url: string, what: string): Promise<ArrayBuffer> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${what} from '${url}': HTTP ${response.status}`);
    }
    const limit = activeLimits.maxFileBytes;
    const declared = Number(response.headers?.get?.("content-length") ?? NaN);
    if (Number.isFinite(declared)) assertByteLimit(`${what} '${url}'`, declared, limit);
    const buffer = await response.arrayBuffer();
    assertByteLimit(`${what} '${url}'`, buffer.byteLength, limit);
    return buffer;
}

/**
 * Reads the pixel size of a PNG, JPEG, GIF, or WebP image from its header bytes, without decoding it.
 *
 * @param bytes Leading bytes of the encoded image (the whole file for JPEG with large metadata)
 * @returns `{ width, height }`, or `undefined` for unknown or truncated formats
 */
export function readImageDimensions(bytes: Uint8Array): { width: number; height: number } | undefined {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const len = bytes.byteLength;
    // PNG: signature, then the IHDR chunk with big-endian width/height
    if (len >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
        return { width: view.getUint32(16), height: view.getUint32(20) };
    }
    // GIF: "GIF8", then little-endian logical screen size
    if (len >= 10 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
        return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
    }
    // JPEG: walk the segments until a start-of-frame marker
    if (len >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
        let offset = 2;
        while (offset + 9 < len) {
            if (bytes[offset] !== 0xff) return undefined;
            const marker = bytes[offset + 1];
            if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
                offset += 2;
                continue;
            }
            const segmentLength = view.getUint16(offset + 2);
            const isFrame =
                marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
            if (isFrame) {
                return { width: view.getUint16(offset + 7), height: view.getUint16(offset + 5) };
            }
            if (segmentLength < 2) return undefined;
            offset += 2 + segmentLength;
        }
        return undefined;
    }
    // WebP: "RIFF" .... "WEBP" + VP8 / VP8L / VP8X chunk
    if (len >= 30 && view.getUint32(0) === 0x52494646 && view.getUint32(8) === 0x57454250) {
        const chunk = view.getUint32(12);
        if (chunk === 0x56503820) {
            return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
        }
        if (chunk === 0x5650384c) {
            const bits = view.getUint32(21, true);
            return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
        }
        if (chunk === 0x56503858) {
            const w = bytes[24] | (bytes[25] << 8) | (bytes[26] << 16);
            const h = bytes[27] | (bytes[28] << 8) | (bytes[29] << 16);
            return { width: w + 1, height: h + 1 };
        }
    }
    return undefined;
}
