/**
 * Deterministic PRNG for share-asset layout.
 *
 * mulberry32 — small, fast, decent distribution. Seeded from a string
 * (typically the user's username) so the same user always gets the same
 * layout. Override with a numeric seed on the dev /share-builder page to
 * "reroll" until a layout reads well.
 */

function stringToSeed(s: string): number {
    let h = 2166136261 >>> 0
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i)
        h = Math.imul(h, 16777619) >>> 0
    }
    return h
}

export class SeededRandom {
    private state: number

    constructor(seed: string | number) {
        const numeric = typeof seed === 'number' ? seed >>> 0 : stringToSeed(seed)
        // mulberry32 hates seed=0; nudge it to 1 if we land there.
        this.state = numeric === 0 ? 1 : numeric
    }

    /** Next float in [0, 1). */
    next(): number {
        let t = (this.state = (this.state + 0x6d2b79f5) >>> 0)
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }

    /** Float in [min, max). */
    float(min: number, max: number): number {
        return min + this.next() * (max - min)
    }

    /** Integer in [min, max] inclusive. */
    int(min: number, max: number): number {
        return Math.floor(this.float(min, max + 1))
    }

    /** Pick one element from an array. Does not mutate. */
    pick<T>(arr: readonly T[]): T {
        return arr[Math.floor(this.next() * arr.length)]
    }

    /** Fisher–Yates shuffle, returns a new array. */
    shuffle<T>(arr: readonly T[]): T[] {
        const out = arr.slice()
        for (let i = out.length - 1; i > 0; i--) {
            const j = Math.floor(this.next() * (i + 1))
            ;[out[i], out[j]] = [out[j], out[i]]
        }
        return out
    }
}
