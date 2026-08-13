import { useState, useEffect } from 'react'
import { useAuth } from '@/context/authContext'
import { apiFetch } from '@/utils/api-fetch'

/** How many times to retry the token fetch before giving up for this mount. */
const MAX_ATTEMPTS = 3

/**
 * Fetch the current user's Crisp session token from the API.
 *
 * The token binds a browser to a Crisp contact, so whoever holds it can read
 * and post in that user's support conversation. It must therefore be
 * unguessable and issued only to the authenticated user. The API derives it
 * from the caller's auth token with a server-only secret; the browser never
 * sees the secret. It used to be computed here from a shipped salt plus the
 * userId, which let anyone reproduce anyone's token.
 *
 * The route echoes the userId it derived the token from. We check it against the
 * account we are fetching for and discard a mismatch, so a stale auth token
 * (shared-device account switch) can never bind the widget to the wrong user.
 *
 * @see https://docs.crisp.chat/guides/chatbox-sdks/web-sdk/session-continuity/
 */
async function fetchCrispToken(expectedUserId: string): Promise<string | undefined> {
    const res = await apiFetch('/user/crisp-token')
    if (!res.ok) return undefined
    const data = (await res.json()) as { crispTokenId?: unknown; userId?: unknown }
    if (data.userId !== expectedUserId) return undefined
    return typeof data.crispTokenId === 'string' ? data.crispTokenId : undefined
}

// In-memory cache so the token is available synchronously after the first fetch,
// preventing an undefined→resolved state change that would cause iframe reloads.
const tokenCache = new Map<string, string>()

/**
 * Hook that returns a stable Crisp token ID for the current user.
 * Returns undefined when not authenticated or before the token resolves.
 */
export function useCrispTokenId(): string | undefined {
    const { userId } = useAuth()
    const [tokenId, setTokenId] = useState<string | undefined>(userId ? tokenCache.get(userId) : undefined)

    useEffect(() => {
        if (!userId) {
            setTokenId(undefined)
            return
        }

        // Reset to THIS user's cached token (or undefined) before any fetch, so an
        // account switch never leaves the previous user's token in state while the
        // new user's token is still loading.
        const cached = tokenCache.get(userId)
        setTokenId(cached)
        if (cached) return

        let cancelled = false
        ;(async () => {
            for (let attempt = 0; attempt < MAX_ATTEMPTS && !cancelled; attempt++) {
                if (attempt > 0) {
                    await new Promise((resolve) => setTimeout(resolve, 300 * attempt))
                    if (cancelled) return
                }
                const token = await fetchCrispToken(userId).catch(() => undefined)
                if (cancelled) return
                if (token) {
                    tokenCache.set(userId, token)
                    setTokenId(token)
                    return
                }
            }
        })()

        return () => {
            cancelled = true
        }
    }, [userId])

    return tokenId
}
