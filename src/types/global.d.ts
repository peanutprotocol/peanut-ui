interface Window {
    // Set by the Capacitor bridge whenever @capacitor/core is bundled — including on
    // web — so presence alone doesn't mean native. isNativePlatform() is the real
    // signal, and it's optional because older bridges don't expose it.
    Capacitor?: {
        getPlatform: () => string
        isNativePlatform?: () => boolean
        // Optional: older bridges predate it. Used to feature-detect native
        // plugins (e.g. NativeBiometric) before entering a code path that
        // needs them.
        isPluginAvailable?: (name: string) => boolean
    }
    gtag?: (command: string, ...args: unknown[]) => void
    // Before client.crisp.chat/l.js loads, $crisp is a plain push-queue array. Once the
    // script loads it upgrades the object in place, adding methods like `is()` — we use
    // the presence of `is` as the "Crisp actually loaded" signal.
    $crisp?: Array<unknown[]> & { is?: (feature: string) => boolean }
    CRISP_TOKEN_ID?: string | null
    CRISP_WEBSITE_ID?: string
    // Set to true by the l.js <script> onerror handler if the Crisp bundle fails to load.
    __crispLoadFailed?: boolean
}

interface Navigator {
    brave?: {
        isBrave: () => Promise<boolean>
    }
    // Non-standard, iOS Safari only: true when running as an installed PWA.
    standalone?: boolean
}
