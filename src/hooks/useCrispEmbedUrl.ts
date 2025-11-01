import { useMemo } from 'react'
import { type CrispUserData } from '@/hooks/useCrispUserData'

const CRISP_WEBSITE_ID = '916078be-a6af-4696-82cb-bc08d43d9125'
const CRISP_EMBED_BASE_URL = `https://go.crisp.chat/chat/embed/?website_id=${CRISP_WEBSITE_ID}`

/**
 * Hook to build Crisp embed URL with user data as URL parameters
 * This bypasses CORS completely - Crisp supports these URL params:
 * - user_email: User's email address (CRITICAL for session persistence)
 * - user_nickname: User's nickname
 * - user_phone: User's phone number
 * - user_avatar: URL to the user's avatar image
 */
export function useCrispEmbedUrl(userData: CrispUserData): string {
    return useMemo(() => {
        const params = new URLSearchParams()

        if (userData.email) {
            params.append('user_email', userData.email)
        }
        if (userData.fullName || userData.username) {
            params.append('user_nickname', userData.fullName || userData.username || '')
        }
        if (userData.avatar) {
            params.append('user_avatar', userData.avatar)
        }

        const queryString = params.toString()
        return queryString ? `${CRISP_EMBED_BASE_URL}&${queryString}` : CRISP_EMBED_BASE_URL
    }, [userData.email, userData.fullName, userData.username, userData.avatar])
}
