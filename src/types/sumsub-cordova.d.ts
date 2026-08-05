// Type declarations for the Sumsub Cordova plugin. The plugin ships no types
// and clobbers `window.SNSMobileSDK` (see its plugin.xml js-module), so it is
// only reachable inside the Capacitor shell — `window.SNSMobileSDK` is
// undefined on web.

declare global {
    /**
     * `SNSSDKState` class name reported by the plugin, on both the launch result
     * and every `onStatusChanged` event. One of: Ready, Initial, Incomplete,
     * Pending, TemporarilyDeclined, FinallyRejected, Approved, ActionCompleted,
     * Failed. Typed as a string because the native side sends it verbatim.
     */
    interface SNSMobileSDKResult {
        success: boolean
        status: string
        errorType?: string | null
        errorMsg?: string | null
    }

    /**
     * Only these two keys are forwarded to native — the plugin's builder
     * silently drops any other handler name, so there is no native equivalent
     * of the web SDK's onApplicantSubmitted/onApplicantActionSubmitted events.
     */
    interface SNSMobileSDKHandlers {
        onStatusChanged?: (event: { newStatus?: string; prevStatus?: string }) => void
        onEvent?: (event: { eventType?: string; payload?: Record<string, unknown> }) => void
    }

    interface SNSMobileSDKBuilder {
        withHandlers(handlers: SNSMobileSDKHandlers): SNSMobileSDKBuilder
        withLocale(locale: string): SNSMobileSDKBuilder
        withDebug(debug: boolean): SNSMobileSDKBuilder
        withAnalyticsEnabled(enabled: boolean): SNSMobileSDKBuilder
        withAutoCloseOnApprove(seconds: number): SNSMobileSDKBuilder
        withBaseUrl(url: string): SNSMobileSDKBuilder
        withSettings(settings: Record<string, unknown>): SNSMobileSDKBuilder
        withTheme(theme: Record<string, unknown>): SNSMobileSDKBuilder
        build(): SNSMobileSDKInstance
    }

    interface SNSMobileSDKInstance {
        /** Resolves only once the native screen closes. */
        launch(): Promise<SNSMobileSDKResult>
        dismiss(): void
    }

    interface Window {
        SNSMobileSDK?: {
            init(accessToken: string, tokenExpirationHandler: () => Promise<string>): SNSMobileSDKBuilder
        }
    }
}

export {}
