declare module '@sumsub/cordova-idensic-mobile-sdk-plugin' {
    interface SNSMobileSDKBuilder {
        withHandlers(handlers: Record<string, (event: any) => void>): SNSMobileSDKBuilder
        withLocale(locale: string): SNSMobileSDKBuilder
        withDebug(debug: boolean): SNSMobileSDKBuilder
        withAnalyticsEnabled(enabled: boolean): SNSMobileSDKBuilder
        withSettings(settings: Record<string, unknown>): SNSMobileSDKBuilder
        withTheme(theme: Record<string, unknown>): SNSMobileSDKBuilder
        withBaseUrl(url: string): SNSMobileSDKBuilder
        withAutoCloseOnApprove(seconds: number): SNSMobileSDKBuilder
        build(): SNSMobileSDKInstance
    }

    interface SNSMobileSDKInstance {
        launch(): Promise<{ status: string; [key: string]: unknown }>
        dismiss(): void
    }

    export const SNSMobileSDK: {
        init(accessToken: string, tokenExpirationHandler: () => Promise<string>): SNSMobileSDKBuilder
    }
}
