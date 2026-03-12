import { useState, useEffect } from 'react'
import { useAuth } from '@/context/authContext'

/**
 * Salt for Crisp token generation.
 * This prevents raw userId from being used as the Crisp token,
 * adding a layer of separation between internal IDs and external services.
 */
const CRISP_TOKEN_SALT = 'peanut-crisp-session-v1'

/**
 * Generates a deterministic Crisp session token from a userId using SHA-256.
 *
 * This ensures the same user always gets the same Crisp conversation,
 * preventing duplicate sessions when cookies are cleared or devices change.
 *
 * @see https://docs.crisp.chat/guides/chatbox-sdks/web-sdk/session-continuity/
 */
async function generateCrispToken(userId: string): Promise<string> {
    const data = new TextEncoder().encode(`${CRISP_TOKEN_SALT}:${userId}`)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

    // Format as UUID v4-like string for Crisp compatibility
    // (Crisp docs recommend UUID format for tokens)
    return [hashHex.slice(0, 8), hashHex.slice(8, 12), hashHex.slice(12, 16), hashHex.slice(16, 20), hashHex.slice(20, 32)].join('-')
}

/**
 * Hook that returns a stable Crisp token ID derived from the current user's ID.
 * Returns undefined when not authenticated or still computing.
 */
export function useCrispTokenId(): string | undefined {
    const { userId } = useAuth()
    const [tokenId, setTokenId] = useState<string | undefined>(undefined)

    useEffect(() => {
        if (!userId) {
            setTokenId(undefined)
            return
        }

        generateCrispToken(userId).then(setTokenId).catch(() => setTokenId(undefined))
    }, [userId])

    return tokenId
}
