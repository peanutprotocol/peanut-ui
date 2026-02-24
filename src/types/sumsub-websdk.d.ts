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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- sumsub sdk event handlers have varying untyped signatures
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
