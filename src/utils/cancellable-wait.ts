/**
 * Bounded wait that a caller can abandon. Sliced so leaving the screen (or any
 * other cancel signal) stops a recovery promptly instead of at the deadline —
 * nothing may be signed or submitted for a flow the user walked away from.
 *
 * Resolves false when cancelled (before or during the wait), true otherwise.
 */
export async function sleepUnlessCancelled(totalMs: number, cancelled: () => boolean): Promise<boolean> {
    const step = 250
    for (let waited = 0; waited < totalMs; waited += step) {
        if (cancelled()) return false
        await new Promise((resolve) => setTimeout(resolve, Math.min(step, totalMs - waited)))
    }
    return !cancelled()
}
