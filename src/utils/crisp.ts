import { type CrispUserData } from '@/hooks/useCrispUserData'

/**
 * Sets Crisp user identification and session metadata on a $crisp instance
 *
 * This is used for the main window Crisp widget (not iframe).
 * Sets user email (critical for session persistence), nickname, avatar,
 * and session metadata visible to support agents.
 *
 * @param crispInstance - The $crisp object (window.$crisp)
 * @param userData - User data to set
 * @param prefilledMessage - Optional message to prefill in chat
 */
export function setCrispUserData(crispInstance: any, userData: CrispUserData, prefilledMessage?: string): void {
    if (!crispInstance) return

    const { username, userId, email, fullName, avatar, grafanaLink, walletAddressLink, bridgeUserId, mantecaUserId } =
        userData

    if (email) {
        crispInstance.push(['set', 'user:email', [email]])
    }

    const nickname = fullName || username || ''
    if (nickname) {
        crispInstance.push(['set', 'user:nickname', [nickname]])
    }

    if (avatar) {
        crispInstance.push(['set', 'user:avatar', [avatar]])
    }

    // Session metadata for support agents - must be 3 levels of nested arrays
    crispInstance.push([
        'set',
        'session:data',
        [
            [
                ['username', username || ''],
                ['user_id', userId || ''],
                ['full_name', fullName || ''],
                ['grafana_dashboard', grafanaLink || ''],
                ['wallet_address', walletAddressLink || ''],
                ['bridge_user_id', bridgeUserId || ''],
                ['manteca_user_id', mantecaUserId || ''],
            ],
        ],
    ])

    if (prefilledMessage) {
        crispInstance.push(['set', 'message:text', [prefilledMessage]])
    }
}

/**
 * Resets Crisp session to prevent session merging between users
 *
 * @param crispInstance - The $crisp object
 */
export function resetCrispSession(crispInstance: any): void {
    if (!crispInstance || typeof window === 'undefined') return

    try {
        crispInstance.push(['do', 'session:reset'])
    } catch (e) {
        console.debug('[Crisp] Could not reset session:', e)
    }
}

/**
 * Resets all Crisp sessions on logout (main window + proxy iframes)
 *
 * Attempts to reset currently mounted proxy iframes via postMessage,
 * and sets a sessionStorage flag for proxy pages that aren't currently mounted.
 */
export function resetCrispProxySessions(): void {
    if (typeof window === 'undefined') return

    try {
        const iframes = document.querySelectorAll('iframe[src*="crisp-proxy"]')

        iframes.forEach((iframe) => {
            try {
                const iframeWindow = (iframe as HTMLIFrameElement).contentWindow
                if (iframeWindow) {
                    iframeWindow.postMessage(
                        {
                            type: 'CRISP_RESET_SESSION',
                        },
                        window.location.origin
                    )
                }
            } catch (e) {
                console.debug('[Crisp] Could not reset proxy iframe:', e)
            }
        })

        if (window.$crisp) {
            resetCrispSession(window.$crisp)
        }

        // Flag for proxy pages that aren't currently mounted
        sessionStorage.setItem('crisp_needs_reset', 'true')
    } catch (e) {
        console.debug('[Crisp] Could not reset proxy sessions:', e)
    }
}
