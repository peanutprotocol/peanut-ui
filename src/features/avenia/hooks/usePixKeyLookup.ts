'use client'

import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { aveniaApi, type PixKeyInfo } from '@/services/avenia'
import { API_ERROR_CODES, apiErrorStatus, wireErrorCode } from '@/services/api-error'
import { pixKeyVerdict, type PixKeyVerdict } from '@/features/avenia/avenia.utils'

/** The API caches a lookup for 10 minutes per user and key; the app keeps it as long. */
const LOOKUP_STALE_MS = 10 * 60_000
/** The API allows one lookup per second per user. */
const THROTTLE_RETRY_MS = 1100

export type PixKeyLookup =
    | { key: string; status: 'found'; info: PixKeyInfo; verdict: PixKeyVerdict }
    | { key: string; status: 'not-found' }
    | { key: string; status: 'failed' }

export const pixKeyInfoQueryKey = (key: string) => ['avenia-pix-key-info', key] as const

/**
 * Resolves a complete Pix key to its holder, bank and own-account verdict
 * (GET /avenia/pix-key-info). Each lookup costs the user's Avenia sub-account
 * DICT tokens, so a key is looked up once and remembered, and the caller sends
 * only complete keys (`completePixKey`) after the input's debounce.
 */
export function usePixKeyLookup() {
    const queryClient = useQueryClient()
    const [result, setResult] = useState<PixKeyLookup | null>(null)

    const fetchInfo = useCallback(
        (key: string) =>
            queryClient.fetchQuery({
                queryKey: pixKeyInfoQueryKey(key),
                queryFn: () => aveniaApi.pixKeyInfo(key),
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
                try {
                    info = await fetchInfo(key)
                } catch (error) {
                    // a second key typed within the second: wait it out once
                    if (wireErrorCode(error) !== API_ERROR_CODES.PIX_KEY_LOOKUP_THROTTLED) throw error
                    await new Promise((resolve) => setTimeout(resolve, THROTTLE_RETRY_MS))
                    info = await fetchInfo(key)
                }
                outcome = { key, status: 'found', info, verdict: pixKeyVerdict(info) }
            } catch (error) {
                outcome = apiErrorStatus(error) === 404 ? { key, status: 'not-found' } : { key, status: 'failed' }
            }
            setResult(outcome)
            return outcome
        },
        [fetchInfo]
    )

    const clear = useCallback(() => setResult(null), [])

    return { lookup, result, clear }
}
