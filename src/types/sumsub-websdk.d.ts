// type declarations for sumsub websdk loaded via CDN script
// https://static.sumsub.com/idensic/static/sns-websdk-builder.js

declare global {
    interface SnsWebSdkInstance {
        launch(container: HTMLElement): void
        destroy(): void
    }

    interface SnsWebSdkBuilderChain {
        withConf(conf: { lang?: string; theme?: string }): SnsWebSdkBuilderChain
        withOptions(opts: { addViewportTag?: boolean; adaptIframeHeight?: boolean }): SnsWebSdkBuilderChain
        on(event: string, handler: (...args: any[]) => void): SnsWebSdkBuilderChain
        build(): SnsWebSdkInstance
    }

    interface SnsWebSdkBuilder {
        init(token: string, refreshCallback: () => Promise<string>): SnsWebSdkBuilderChain
    }

    interface Window {
        snsWebSdk: SnsWebSdkBuilder
    }
}

export {}
