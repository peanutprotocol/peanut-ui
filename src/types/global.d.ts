interface Window {
    gtag?: (command: string, ...args: unknown[]) => void
    $crisp?: Array<unknown[]>
    CRISP_TOKEN_ID?: string | null
    CRISP_WEBSITE_ID?: string
}

interface Navigator {
    brave?: {
        isBrave: () => Promise<boolean>
    }
}
