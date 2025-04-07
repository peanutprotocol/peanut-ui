'use client'
import { JustaNameContext } from '@/config/justaname.config'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import {
    AppKitNetwork,
    arbitrum,
    base,
    bsc,
    gnosis,
    mainnet,
    mantle,
    optimism,
    polygon,
    scroll,
} from '@reown/appkit/networks'
import { createAppKit } from '@reown/appkit/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, cookieToInitialState, type Config } from 'wagmi'

// 0. Setup queryClient
const queryClient = new QueryClient()

// 1. Get projectId at https://cloud.reown.com
const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? ''

// 2. Create wagmiConfig
const metadata = {
    name: 'Peanut Protocol',
    description: 'Peanut protocol - send crypto with links',
    url: process.env.NEXT_PUBLIC_BASE_URL || 'https://peanut.to', // origin must match your domain & subdomain
    icons: [`${process.env.NEXT_PUBLIC_BASE_URL}/favicon.ico`],
}

export const networks = [arbitrum, mainnet, optimism, polygon, gnosis, base, scroll, mantle, bsc] as [
    AppKitNetwork,
    ...AppKitNetwork[],
]

// 5. Create WagmiAdapter with required properties
const wagmiAdapter = new WagmiAdapter({
    networks,
    projectId,
    ssr: true,
})

// 6. Create AppKit
createAppKit({
    adapters: [wagmiAdapter],
    defaultNetwork: mainnet,
    networks,
    metadata,
    projectId,
    features: {
        analytics: true,
        socials: false,
        email: false,
        onramp: true,
    },
    themeVariables: {
        '--w3m-border-radius-master': '0px',
        '--w3m-color-mix': 'white',
    },
})

export function ContextProvider({ children, cookies }: { children: React.ReactNode; cookies: string | null }) {
    /**
     * converts the provided cookies into an initial state for the application.
     *
     * @param {Config} wagmiConfig - The configuration object for the wagmi adapter.
     * @param {Record<string, string>} cookies - An object representing the cookies.
     * @returns {InitialState} The initial state derived from the cookies.
     */
    const initialState = cookieToInitialState(wagmiAdapter.wagmiConfig as Config, cookies)

    return (
        <WagmiProvider config={wagmiAdapter.wagmiConfig} initialState={initialState}>
            <QueryClientProvider client={queryClient}>
                <JustaNameContext>{children}</JustaNameContext>
            </QueryClientProvider>
        </WagmiProvider>
    )
}
