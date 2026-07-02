// Display labels where plain title-case reads wrong.
const CHAIN_DISPLAY_OVERRIDES: Record<string, string> = {
    BNB: 'BNB Chain',
}

/** rhino.consts chain key (e.g. 'ARBITRUM', 'BNB') → human display name */
export const chainDisplayName = (chain: string): string =>
    CHAIN_DISPLAY_OVERRIDES[chain] ?? chain.charAt(0) + chain.slice(1).toLowerCase()
