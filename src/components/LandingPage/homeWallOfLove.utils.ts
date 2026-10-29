/**
 * Deals the posts round-robin into `slots` stacks: slot 0 holds posts 0, 3, 6…
 * so the first screen shows the first `slots` posts of the curated order.
 */
export function dealIntoSlots<T>(posts: readonly T[], slots: number): T[][] {
    const stacks: T[][] = Array.from({ length: Math.min(slots, posts.length) }, () => [])
    posts.forEach((post, i) => stacks[i % stacks.length].push(post))
    return stacks
}

/**
 * The next shown post per slot after `tick`: the slot whose turn it is
 * (tick mod slots) moves to its next post and wraps; the others stay.
 */
export function advanceSlots(active: readonly number[], tick: number, sizes: readonly number[]): number[] {
    if (sizes.length === 0) return [...active]
    const slot = tick % sizes.length
    return active.map((shown, i) => (i === slot && sizes[i] > 1 ? (shown + 1) % sizes[i] : shown))
}
