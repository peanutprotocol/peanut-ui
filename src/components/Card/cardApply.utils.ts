/**
 * Sumsub's auto-review usually settles in well under a second, but sometimes
 * lags. Poll the apply endpoint until backend stops returning `incomplete`,
 * then surface the response. Returns `{ status: 'timeout' }` if the deadline
 * passes without advancement so the caller can show a retry message.
 *
 * Without this, the immediate post-Sumsub re-apply races against Sumsub and
 * dumps the user back on the "Start Secure Verification" interstitial when
 * the WebSDK re-opens against an already-approved applicant.
 */
export async function pollUntilApplyAdvances<R extends { status: string }>({
    fetchApply,
    intervalMs,
    timeoutMs,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    now = () => Date.now(),
}: {
    fetchApply: () => Promise<R>
    intervalMs: number
    timeoutMs: number
    sleep?: (ms: number) => Promise<void>
    now?: () => number
}): Promise<R | { status: 'timeout' }> {
    const start = now()
    while (true) {
        const res = await fetchApply()
        if (res.status !== 'incomplete') return res
        await sleep(intervalMs)
        if (now() - start >= timeoutMs) return { status: 'timeout' as const }
    }
}
