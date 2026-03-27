import { useState, useEffect } from 'react'
import { useAuth } from '@/context/authContext'

const CRISP_TOKEN_SALT = 'peanut-crisp-session-v1'

/**
 * Generates a deterministic Crisp session token from a userId using SHA-256.
 * Formatted as UUID-like string for Crisp compatibility.
 *
 * @see https://docs.crisp.chat/guides/chatbox-sdks/web-sdk/session-continuity/
 */
async function generateCrispToken(userId: string): Promise<string> {
    const data = new TextEncoder().encode(`${CRISP_TOKEN_SALT}:${userId}`)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

    return [
        hashHex.slice(0, 8),
        hashHex.slice(8, 12),
        hashHex.slice(12, 16),
        hashHex.slice(16, 20),
        hashHex.slice(20, 32),
    ].join('-')
}

// In-memory cache so the token is available synchronously after first computation,
// preventing an undefined→resolved state change that would cause iframe reloads.
const tokenCache = new Map<string, string>()

/**
 * Hook that returns a stable Crisp token ID derived from the current user's ID.
 * Returns undefined when not authenticated.
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

        generateCrispToken(userId)
            .then((token) => {
                tokenCache.set(userId, token)
                setTokenId(token)
            })
            .catch(() => setTokenId(undefined))
    }, [userId])

    return tokenId
}
