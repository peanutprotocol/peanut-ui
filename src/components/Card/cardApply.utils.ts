/**
 * Sumsub's auto-review usually settles in well under a second, but sometimes
 * lags. Poll the apply endpoint until backend stops returning `incomplete`,
 * then surface the response. Returns `null` on timeout or when `signal` is
 * aborted so the caller can show a retry message (or stop entirely).
 *
 * Without this, the immediate post-Sumsub re-apply races against Sumsub and
 * dumps the user back on the "Start Secure Verification" interstitial when
 * the WebSDK re-opens against an already-approved applicant. The signal lets
 * the caller stop the loop on unmount so we don't burn 15 sequential fetches
 * after the user navigates away from the pending screen.
 */
export async function pollUntilApplyAdvances<R extends { status: string }>({
    fetchApply,
    intervalMs,
    timeoutMs,
    signal,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    now = () => Date.now(),
}: {
    fetchApply: () => Promise<R>
    intervalMs: number
    timeoutMs: number
    signal?: AbortSignal
    sleep?: (ms: number) => Promise<void>
    now?: () => number
}): Promise<R | null> {
    const start = now()
    while (true) {
        if (signal?.aborted) return null
        const res = await fetchApply()
        if (res.status !== 'incomplete') return res
        await sleep(intervalMs)
        if (signal?.aborted) return null
        if (now() - start >= timeoutMs) return null
    }
}
