import type { ApplyForCardResponse } from '@/services/rain'

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

/**
 * Sumsub level the WebSDK was just opened at. Tracked at the call site so
 * `resolvePostSumsubAction` can tell a level transition apart from "Sumsub
 * auto-review still pending".
 */
export type SumsubLevel = 'main' | 'rain-card-application'

/**
 * What the caller should do after the Sumsub WebSDK closes successfully.
 *
 * - `reopen-websdk`: the user just completed one Sumsub level and the BE has
 *   moved on to the next one (e.g. MAIN selfie done → card-application
 *   questionnaire pending). Reopen the WebSDK with the new token.
 * - `advance`: the apply response has settled — route on `response.status`.
 * - `timeout`: poll hit the deadline without the response advancing.
 * - `aborted`: the abort signal fired before the resolution completed.
 */
export type PostSumsubAction =
    | { kind: 'reopen-websdk'; sumsubAccessToken: string; level: SumsubLevel }
    | { kind: 'advance'; response: ApplyForCardResponse }
    | { kind: 'timeout' }
    | { kind: 'aborted' }

/**
 * Resolve what to do after the Sumsub WebSDK fires `onComplete`.
 *
 * The card application flow can require TWO Sumsub levels back-to-back:
 *
 *   1. `main` — main applicant docs Rain requires (e.g. SELFIE after liveness
 *      was added to the Sumsub level config)
 *   2. `rain-card-application` — the card-specific questionnaire (occupation,
 *      annual salary, account purpose, expected monthly volume)
 *
 * When the user finishes step 1, the BE's next `/rain/cards` call returns
 * `status: 'incomplete'` with a new token at level 2 — that's a LEVEL
 * TRANSITION, not "Sumsub auto-review still pending". Reading `incomplete`
 * as "keep polling" leaves the user stuck on a 15s timeout screen even
 * though the BE is already telling us what to do next. `resolvePostSumsubAction`
 * branches on the level the WebSDK was just closed at:
 *
 * - just-completed `main`: single fetch, expect `incomplete` + new token,
 *   reopen the WebSDK at `rain-card-application`. Falls through to `advance`
 *   in the edge case where the BE skips straight to `terms-required` (e.g.
 *   questionnaire was already filled in a prior attempt).
 * - just-completed `rain-card-application` (or unknown): poll until the
 *   response advances past `incomplete` — Sumsub auto-review for the
 *   questionnaire is the only thing the response is waiting on.
 */
export async function resolvePostSumsubAction({
    justCompletedLevel,
    fetchApply,
    intervalMs,
    timeoutMs,
    signal,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    now = () => Date.now(),
}: {
    justCompletedLevel: SumsubLevel | null
    fetchApply: () => Promise<ApplyForCardResponse>
    intervalMs: number
    timeoutMs: number
    signal?: AbortSignal
    sleep?: (ms: number) => Promise<void>
    now?: () => number
}): Promise<PostSumsubAction> {
    if (justCompletedLevel === 'main') {
        if (signal?.aborted) return { kind: 'aborted' }
        const res = await fetchApply()
        if (signal?.aborted) return { kind: 'aborted' }
        if (res.status === 'incomplete' && 'sumsubAccessToken' in res) {
            return {
                kind: 'reopen-websdk',
                sumsubAccessToken: res.sumsubAccessToken,
                level: 'rain-card-application',
            }
        }
        return { kind: 'advance', response: res }
    }
    const res = await pollUntilApplyAdvances({ fetchApply, intervalMs, timeoutMs, signal, sleep, now })
    if (res === null) return signal?.aborted ? { kind: 'aborted' } : { kind: 'timeout' }
    return { kind: 'advance', response: res }
}
