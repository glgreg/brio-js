/**
 * Stable in-place sort of `items[0..count)` (bottom-up merge sort), allocation-free in steady state: `scratch` is a
 * caller-owned array that only grows when a larger list is sorted. `Array.prototype.sort` allocates a work buffer
 * on every call, and insertion sort degrades to O(n^2) on lists rebuilt in arbitrary order every frame.
 *
 * @internal
 * @param items Array to sort in place
 * @param count Number of leading elements to sort
 * @param compare Comparator (negative when `a` goes first)
 * @param scratch Reusable buffer owned by the caller
 */
export function sortInPlace<T>(
    items: T[],
    count: number,
    compare: (a: T, b: T) => number,
    scratch: T[],
): void {
    if (count < 2) return;
    // Short runs are insertion-sorted first (fast and allocation-free), then merged pairwise
    const RUN = 16;
    for (let start = 0; start < count; start += RUN) {
        const end = Math.min(start + RUN, count);
        for (let i = start + 1; i < end; i++) {
            const item = items[i];
            let j = i - 1;
            while (j >= start && compare(items[j], item) > 0) {
                items[j + 1] = items[j];
                j--;
            }
            items[j + 1] = item;
        }
    }
    if (count <= RUN) return;
    if (scratch.length < count) scratch.length = count;
    let source = items;
    let target = scratch;
    for (let width = RUN; width < count; width *= 2) {
        for (let left = 0; left < count; left += width * 2) {
            const mid = Math.min(left + width, count);
            const right = Math.min(left + width * 2, count);
            let i = left;
            let j = mid;
            let k = left;
            while (i < mid && j < right) {
                target[k++] = compare(source[j], source[i]) < 0 ? source[j++] : source[i++];
            }
            while (i < mid) target[k++] = source[i++];
            while (j < right) target[k++] = source[j++];
        }
        const swap = source;
        source = target;
        target = swap;
    }
    if (source !== items) {
        for (let i = 0; i < count; i++) items[i] = source[i];
    }
    // Drop references so the scratch buffer does not keep released objects alive
    for (let i = 0; i < count; i++) scratch[i] = undefined as unknown as T;
}
