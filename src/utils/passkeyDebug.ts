import * as Sentry from '@sentry/nextjs'

/**
 * captures debug information about passkey and device capabilities
 * useful for troubleshooting passkey setup and transaction signing issues
 */
export const capturePasskeyDebugInfo = async (context: string) => {
    try {
        // compute rpID the same way it's done in useZeroDev
        const rpId = window.location.hostname.replace(/^www\./, '')

        const debugInfo: Record<string, any> = {
            context,
            timestamp: new Date().toISOString(),
            // rpID info - critical for debugging android issues
            rpId,
            hostname: window.location.hostname,
            origin: window.location.origin,
            // basic environment checks
            isSecureContext: window.isSecureContext,
            cookieEnabled: navigator.cookieEnabled,
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            // android detection
            isAndroid: /android/i.test(navigator.userAgent),
            // credentials api availability
            credentialsApiAvailable: 'credentials' in navigator,
            publicKeyCredentialAvailable: typeof window.PublicKeyCredential !== 'undefined',
        }

        // check conditional mediation support
        if (window.PublicKeyCredential) {
            try {
                debugInfo.conditionalMediationAvailable =
                    await window.PublicKeyCredential.isConditionalMediationAvailable()
            } catch (e) {
                debugInfo.conditionalMediationError = (e as Error).message
            }

            // check user verifying platform authenticator availability
            try {
                debugInfo.platformAuthenticatorAvailable =
                    await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
            } catch (e) {
                debugInfo.platformAuthenticatorError = (e as Error).message
            }
        }

        // check for stored credentials (non-intrusive check)
        if (navigator.credentials) {
            try {
                console.log('navigator.credentials object:', navigator.credentials)
            } catch (e) {
                debugInfo.credentialsObjectError = (e as Error).message
            }
        }

        // log to sentry with all collected info
        Sentry.captureMessage(`Passkey Debug Info: ${context}`, {
            level: 'info',
            extra: debugInfo,
        })

        console.log('[PasskeyDebug]', debugInfo)
        return debugInfo
    } catch (error) {
        console.error('[PasskeyDebug] Error capturing debug info:', error)
        Sentry.captureException(error, {
            extra: { debugContext: context },
        })
        return null
    }
}
