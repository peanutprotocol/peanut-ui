import { useMemo } from 'react'
import { useLocale } from 'next-intl'
import { type CrispUserData } from '@/hooks/useCrispUserData'
import type { AppLocale } from '@/i18n/app/config'

/* Crisp chatbox locales (https://docs.crisp.chat — CRISP_RUNTIME_CONFIG.locale)
   are lowercase and coarser than the app's; both Spanish variants map to "es". */
const CRISP_LOCALE_BY_APP_LOCALE: Record<AppLocale, string> = {
    en: 'en',
    'es-419': 'es',
    'es-AR': 'es',
    'pt-BR': 'pt-br',
}

/**
 * Builds URL for Crisp proxy page with user data as query parameters
 *
 * This follows Crisp's recommended pattern for iframe embedding with JS SDK control.
 * All data is passed via URL params so the proxy page can set it during Crisp initialization,
 * avoiding timing issues with async postMessage approaches.
 *
 * @param userData - User data to encode in URL
 * @param prefilledMessage - Optional message to prefill in chat
 * @param crispTokenId - Stable token for Crisp session continuity (prevents duplicate conversations)
 * @returns URL path to crisp-proxy page with encoded parameters
 */
export function useCrispProxyUrl(userData: CrispUserData, prefilledMessage?: string, crispTokenId?: string): string {
    const locale = useLocale() as AppLocale
    return useMemo(() => {
        const params = new URLSearchParams()

        params.append('locale', CRISP_LOCALE_BY_APP_LOCALE[locale] ?? 'en')

        if (crispTokenId) {
            params.append('crisp_token_id', crispTokenId)
        }

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
            userData.walletAddressLink ||
            userData.bridgeCustomerLink ||
            userData.mantecaUserId ||
            userData.posthogPersonLink
        ) {
            const sessionData = JSON.stringify({
                username: userData.username || '',
                user_id: userData.userId || '',
                full_name: userData.fullName || '',
                wallet_address: userData.walletAddressLink || '',
                bridge_user_id: userData.bridgeCustomerLink || '',
                manteca_user_id: userData.mantecaUserId || '',
                posthog_person: userData.posthogPersonLink || '',
            })
            params.append('session_data', sessionData)
        }

        if (prefilledMessage) {
            params.append('prefilled_message', prefilledMessage)
        }

        const queryString = params.toString()
        return queryString ? `/crisp-proxy?${queryString}` : '/crisp-proxy'
    }, [
        crispTokenId,
        userData.email,
        userData.fullName,
        userData.username,
        userData.avatar,
        userData.userId,
        userData.walletAddressLink,
        userData.bridgeCustomerLink,
        userData.mantecaUserId,
        userData.posthogPersonLink,
        prefilledMessage,
        locale,
    ])
}
