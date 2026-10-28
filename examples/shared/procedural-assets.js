// Procedural assets for the BrioJS examples: images are inline SVG and sounds are synthesized WAV files,
// so the examples ship without binary files and with no third-party licenses.

/**
 * Builds an SVG data URL usable as a `BrioSprite` source.
 *
 * @param {number} width Image width in pixels
 * @param {number} height Image height in pixels
 * @param {string} body SVG markup placed inside the root element
 * @returns {string} `data:image/svg+xml` URL
 */
export function svgSprite(width, height, body) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Synthesizes a short mono 16-bit WAV file and returns a `blob:` URL usable as a `BrioAudio` source.
 *
 * @param {object} options
 * @param {number} options.duration Length in seconds
 * @param {(t: number) => number} options.frequency Frequency in Hz at time `t` (seconds)
 * @param {"sine" | "square" | "noise"} [options.wave] Oscillator shape (defaults to `"sine"`)
 * @param {number} [options.volume] Peak amplitude in `[0, 1]` (defaults to `0.4`)
 * @returns {string} Object URL of the generated WAV
 */
export function synthWav({ duration, frequency, wave = "sine", volume = 0.4 }) {
    const sampleRate = 22050;
    const samples = Math.floor(duration * sampleRate);
    const buffer = new ArrayBuffer(44 + samples * 2);
    const view = new DataView(buffer);
    /** @param {number} offset @param {string} text */
    const writeText = (offset, text) => {
        for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
    };
    writeText(0, "RIFF");
    view.setUint32(4, 36 + samples * 2, true);
    writeText(8, "WAVE");
    writeText(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeText(36, "data");
    view.setUint32(40, samples * 2, true);

    let phase = 0;
    let noiseSeed = 12345;
    for (let i = 0; i < samples; i++) {
        const t = i / sampleRate;
        phase += (2 * Math.PI * frequency(t)) / sampleRate;
        let value;
        if (wave === "square") value = Math.sin(phase) >= 0 ? 1 : -1;
        else if (wave === "noise") {
            noiseSeed = (noiseSeed * 1103515245 + 12345) & 0x7fffffff;
            value = noiseSeed / 0x3fffffff - 1;
        } else value = Math.sin(phase);
        // Short attack and linear release avoid clicks
        const envelope = Math.min(1, t / 0.005) * (1 - t / duration);
        view.setInt16(44 + i * 2, value * envelope * volume * 32767, true);
    }
    return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}
