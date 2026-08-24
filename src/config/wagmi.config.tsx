'use client'
import { WagmiProvider, cookieToInitialState, createConfig, http, type Config } from 'wagmi'
import { arbitrum, bsc, celo, gnosis, linea, mainnet, optimism, polygon, scroll, worldchain } from 'wagmi/chains'

// Base intentionally absent: WAGMI's `http()` (no URL) defaults to mainnet.base.org,
// which IP-rate-limits us with 403s and pollutes the console. We don't use Base for
// external-wallet flows. If Base support is needed for an actual user flow, give it
// an explicit RPC URL (Chainstack key) instead of `http()`.
export const networks = [arbitrum, mainnet, optimism, polygon, gnosis, scroll, bsc, linea, worldchain, celo]

export const wagmiConfig = createConfig({
    chains: [arbitrum, mainnet, optimism, polygon, gnosis, scroll, bsc, linea, worldchain, celo],
    ssr: true,
    transports: {
        [arbitrum.id]: http(),
        [mainnet.id]: http(),
        [optimism.id]: http(),
        [polygon.id]: http(),
        [gnosis.id]: http(),
        [scroll.id]: http(),
        [bsc.id]: http(),
        [linea.id]: http(),
        [worldchain.id]: http(),
        [celo.id]: http(),
    },
})

/**
 * Mounted only on app routes. Importing this module pulls wagmi (and viem's
 * connector surface) into the chunk, which the marketing site has no use for —
 * `PeanutProvider` loads it lazily behind `isMarketingRoute`.
 */
export function WagmiRoot({ children, cookies }: { children: React.ReactNode; cookies: string | null }) {
    const initialState = cookieToInitialState(wagmiConfig as Config, cookies)

    return (
        <WagmiProvider config={wagmiConfig} initialState={initialState}>
            {children}
        </WagmiProvider>
    )
}
