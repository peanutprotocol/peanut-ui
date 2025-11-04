import { useMemo } from 'react'
import { type CrispUserData } from '@/hooks/useCrispUserData'

/**
 * Builds URL for Crisp proxy page with user data as query parameters
 *
 * This follows Crisp's recommended pattern for iframe embedding with JS SDK control.
 * All data is passed via URL params so the proxy page can set it during Crisp initialization,
 * avoiding timing issues with async postMessage approaches.
 *
 * @param userData - User data to encode in URL
 * @param prefilledMessage - Optional message to prefill in chat
 * @returns URL path to crisp-proxy page with encoded parameters
 */
export function useCrispProxyUrl(userData: CrispUserData, prefilledMessage?: string): string {
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

        // Session metadata as JSON for support agents
        if (
            userData.username ||
            userData.userId ||
            userData.fullName ||
            userData.grafanaLink ||
            userData.walletAddressLink ||
            userData.bridgeUserId ||
            userData.mantecaUserId
        ) {
            const sessionData = JSON.stringify({
                username: userData.username || '',
                user_id: userData.userId || '',
                full_name: userData.fullName || '',
                grafana_dashboard: userData.grafanaLink || '',
                wallet_address: userData.walletAddressLink || '',
                bridge_user_id: userData.bridgeUserId || '',
                manteca_user_id: userData.mantecaUserId || '',
            })
            params.append('session_data', sessionData)
        }

        if (prefilledMessage) {
            params.append('prefilled_message', prefilledMessage)
        }

        const queryString = params.toString()
        return queryString ? `/crisp-proxy?${queryString}` : '/crisp-proxy'
    }, [
        userData.email,
        userData.fullName,
        userData.username,
        userData.avatar,
        userData.userId,
        userData.grafanaLink,
        userData.walletAddressLink,
        userData.bridgeUserId,
        userData.mantecaUserId,
        prefilledMessage,
    ])
}
