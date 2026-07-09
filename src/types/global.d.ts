interface Window {
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
}
