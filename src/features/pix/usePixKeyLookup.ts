'use client'

import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { pixApi, type PixKeyInfo } from '@/services/pix'
import { API_ERROR_CODES, apiErrorStatus, wireErrorCode } from '@/services/api-error'
import { pixKeyVerdict, type PixKeyVerdict } from '@/features/pix/pixFlow.utils'

/** The API caches a lookup for 10 minutes per user and key; the app keeps it as long. */
const LOOKUP_STALE_MS = 10 * 60_000
/** The API allows one lookup per second per user. */
const THROTTLE_RETRY_MS = 1100
/** A provider still checking the key (409 `PIX_KEY_CHECK_PENDING`) is asked again this often, this many times. */
export const CHECK_PENDING_RETRY_MS = 2000
export const CHECK_PENDING_RETRIES = 2

/**
 * What a lookup learned. Beside a key that resolved or does not exist:
 * - `checking`: the provider was still checking the key after the retries; nothing moved, ask again.
 * - `unusable`: a payout to this key bounced; another key is needed.
 * - `throttled`: too many new keys in a short time.
 * - `refused`: the route does not serve the user now (403); `residence` when the residence block says so.
 * - `failed`: the provider is down (502), the network failed or the call timed out; a retry is safe.
 */
export type PixKeyLookup =
    | { key: string; status: 'found'; info: PixKeyInfo; verdict: PixKeyVerdict }
    | { key: string; status: 'not-found' }
    | { key: string; status: 'checking' }
    | { key: string; status: 'unusable' }
    | { key: string; status: 'throttled' }
    | { key: string; status: 'refused'; residence: boolean }
    | { key: string; status: 'failed' }

export const pixKeyInfoQueryKey = (key: string) => ['pix-key', key] as const

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** A lookup's refusal as the step reads it, from the wire code first, then the status. */
function refusedLookup(key: string, error: unknown): PixKeyLookup {
    const code = wireErrorCode(error)
    const status = apiErrorStatus(error)
    if (code === API_ERROR_CODES.PIX_KEY_NOT_FOUND || status === 404) return { key, status: 'not-found' }
    if (code === API_ERROR_CODES.PIX_KEY_CHECK_PENDING) return { key, status: 'checking' }
    if (code === API_ERROR_CODES.BANK_ACCOUNT_NOT_USABLE) return { key, status: 'unusable' }
    if (code === API_ERROR_CODES.PIX_KEY_LOOKUP_THROTTLED || status === 429) return { key, status: 'throttled' }
    // the route's own refusal, or the residence block's codes
    if (status === 403) return { key, status: 'refused', residence: code !== API_ERROR_CODES.ROUTE_NOT_AVAILABLE }
    return { key, status: 'failed' }
}

/**
 * Resolves a complete Pix key to its holder, bank and own-account verdict
 * (POST /pix/key). A lookup can cost the provider directory tokens, so a key is
 * looked up once and remembered, and the caller sends only complete keys
 * (`completePixKey`) after the input's debounce. A provider that is still
 * checking a new key is asked again a few times before the step offers a retry:
 * whose key it is is never guessed.
 */
export function usePixKeyLookup() {
    const queryClient = useQueryClient()
    const [result, setResult] = useState<PixKeyLookup | null>(null)

    const fetchInfo = useCallback(
        (key: string) =>
            queryClient.fetchQuery({
                queryKey: pixKeyInfoQueryKey(key),
                queryFn: () => pixApi.lookupKey(key),
                staleTime: LOOKUP_STALE_MS,
                retry: false,
            }),
        [queryClient]
    )

    const lookup = useCallback(
        async (key: string): Promise<PixKeyLookup> => {
            let outcome: PixKeyLookup
            try {
                let info: PixKeyInfo
                // one answer ends the loop, whatever it holds: only a refusal asks again, a bounded number of times
                for (let attempt = 0; ; attempt++) {
                    try {
                        info = await fetchInfo(key)
                        break
                    } catch (error) {
                        const code = wireErrorCode(error)
                        // a second key typed within the second: wait it out once
                        if (code === API_ERROR_CODES.PIX_KEY_LOOKUP_THROTTLED && attempt === 0) {
                            await sleep(THROTTLE_RETRY_MS)
                            continue
                        }
                        // the provider still checks the key: nothing moved, so asking again is safe
                        if (code === API_ERROR_CODES.PIX_KEY_CHECK_PENDING && attempt < CHECK_PENDING_RETRIES) {
                            await sleep(CHECK_PENDING_RETRY_MS)
                            continue
                        }
                        throw error
                    }
                }
                outcome = { key, status: 'found', info, verdict: pixKeyVerdict(info) }
            } catch (error) {
                outcome = refusedLookup(key, error)
            }
            setResult(outcome)
            return outcome
        },
        [fetchInfo]
    )

    const clear = useCallback(() => setResult(null), [])

    return { lookup, result, clear }
}
