import { useState, useEffect } from 'react'
import { useAuth } from '@/context/authContext'
import { apiFetch } from '@/utils/api-fetch'

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
 * @see https://docs.crisp.chat/guides/chatbox-sdks/web-sdk/session-continuity/
 */
async function fetchCrispToken(): Promise<string | undefined> {
    const res = await apiFetch('/user/crisp-token')
    if (!res.ok) return undefined
    const data = (await res.json()) as { crispTokenId?: unknown }
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

        const cached = tokenCache.get(userId)
        if (cached) {
            setTokenId(cached)
            return
        }

        let cancelled = false
        fetchCrispToken()
            .then((token) => {
                if (cancelled || !token) return
                tokenCache.set(userId, token)
                setTokenId(token)
            })
            .catch(() => {
                if (!cancelled) setTokenId(undefined)
            })

        return () => {
            cancelled = true
        }
    }, [userId])

    return tokenId
}
