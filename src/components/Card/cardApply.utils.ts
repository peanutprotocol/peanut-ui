/**
 * Sumsub's auto-review usually settles in well under a second, but sometimes
 * lags. Poll the apply endpoint until backend stops returning `incomplete`,
 * then surface the response. Returns `null` on timeout or when `signal` is
 * aborted so the caller can show a retry message (or stop entirely).
 *
 * Without this, the immediate post-Sumsub re-apply races against Sumsub and
 * re-opens the WebSDK against an already-approved applicant. The signal lets
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

/**
 * Cheap poll-until-ready helper for the post-Sumsub-WebSDK-close window.
 *
 * Each `fetchReadiness` call reads a single webhook-stamped flag from our DB
 * (no Sumsub round-trip), so it's safe to poll fast. Returns `true` when the
 * backend reports `ready: true` (Sumsub finished reviewing rain-requirements
 * GREEN), `false` on a clean timeout (backend healthy but never went ready),
 * `null` on abort. If the MOST RECENT poll failed (persistent auth/5xx), it
 * re-throws that error on timeout so the caller surfaces the real reason
 * instead of a misleading "taking longer than expected".
 *
 * Replaces the previous pattern of polling `POST /rain/cards` itself — each
 * of those calls did `moveToLevel` + `getApplicant` + `getQuestionnaireAnswers`
 * against Sumsub's API, costing ~5 round-trips per poll × 15 polls per stuck
 * user.
 */
export async function pollUntilReady({
    fetchReadiness,
    intervalMs,
    timeoutMs,
    signal,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    now = () => Date.now(),
}: {
    fetchReadiness: () => Promise<{ ready: boolean }>
    intervalMs: number
    timeoutMs: number
    signal?: AbortSignal
    sleep?: (ms: number) => Promise<void>
    now?: () => number
}): Promise<boolean | null> {
    const start = now()
    let lastError: unknown
    while (true) {
        if (signal?.aborted) return null
        try {
            const { ready } = await fetchReadiness()
            if (ready) return true
            // a clean (not-yet-ready) response means the backend is healthy —
            // clear any earlier transient error so we don't surface a stale one.
            lastError = undefined
        } catch (err) {
            // Swallow transient fetch errors mid-poll and retry, but remember the
            // most recent one: a persistent failure (auth, 5xx) should surface its
            // real reason on timeout instead of a misleading "taking longer".
            lastError = err
        }
        await sleep(intervalMs)
        if (signal?.aborted) return null
        if (now() - start >= timeoutMs) {
            if (lastError) throw lastError
            return false
        }
    }
}
