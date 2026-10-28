/** Minimal Web Audio API double: records the node graph and lets tests end sources manually. */
export class FakeAudioParam {
    value = 1;
}

export class FakeNode {
    connections: FakeNode[] = [];
    connect(node: FakeNode): FakeNode {
        this.connections.push(node);
        return node;
    }
    disconnect(): void {
        this.connections = [];
    }
}

export class FakeGain extends FakeNode {
    gain = new FakeAudioParam();
}

export class FakeBufferSource extends FakeNode {
    buffer: { duration: number } | null = null;
    loop = false;
    onended: (() => void) | null = null;
    started?: { when: number; offset: number };
    stopped = false;
    start(when = 0, offset = 0): void {
        this.started = { when, offset };
    }
    stop(): void {
        this.stopped = true;
    }
    /** Simulates the natural end of playback. */
    finish(): void {
        this.onended?.();
    }
}

export class FakeAudioContext {
    static instances: FakeAudioContext[] = [];
    state: "suspended" | "running" | "closed" = "suspended";
    currentTime = 0;
    destination = new FakeNode();
    sources: FakeBufferSource[] = [];
    gains: FakeGain[] = [];
    constructor() {
        FakeAudioContext.instances.push(this);
    }
    createGain(): FakeGain {
        const gain = new FakeGain();
        this.gains.push(gain);
        return gain;
    }
    createBufferSource(): FakeBufferSource {
        const source = new FakeBufferSource();
        this.sources.push(source);
        return source;
    }
    async decodeAudioData(data: ArrayBuffer): Promise<{ duration: number }> {
        return { duration: data.byteLength / 10 };
    }
    async resume(): Promise<void> {
        this.state = "running";
    }
    async suspend(): Promise<void> {
        this.state = "suspended";
    }
    async close(): Promise<void> {
        this.state = "closed";
    }
}
