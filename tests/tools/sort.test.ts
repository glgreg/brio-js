import { describe, expect, it } from "vitest";
import { sortInPlace } from "../../src/tools/sort";

describe("sortInPlace", () => {
    it("sorts the leading elements stably and leaves the rest untouched", () => {
        const scratch: { k: number; i: number }[] = [];
        for (const n of [0, 1, 5, 16, 17, 33, 100, 257]) {
            const items = Array.from({ length: n }, (_, i) => ({ k: (i * 7919) % 13, i }));
            const tail = { k: -1, i: -1 };
            items.push(tail);
            sortInPlace(items, n, (a, b) => a.k - b.k, scratch);
            for (let i = 1; i < n; i++) {
                const a = items[i - 1];
                const b = items[i];
                expect(a.k < b.k || (a.k === b.k && a.i < b.i)).toBe(true);
            }
            expect(items[n]).toBe(tail);
            expect(scratch.every((entry) => entry === undefined)).toBe(true);
        }
    });
});
