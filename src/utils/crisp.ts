/**
 * Resets Crisp session to prevent session merging between users
 *
 * @param crispInstance - The $crisp object
 */
export function resetCrispSession(crispInstance: any): void {
    if (!crispInstance || typeof window === 'undefined') return

    try {
        // Clear CRISP_TOKEN_ID before resetting session to fully unbind the user.
        // This prevents the next anonymous session from inheriting the previous user's conversation.
        // @see https://docs.crisp.chat/guides/chatbox-sdks/web-sdk/session-continuity/
        window.CRISP_TOKEN_ID = null

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
