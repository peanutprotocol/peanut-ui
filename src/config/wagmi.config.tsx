'use client'
import { JustaNameContext } from '@/config/justaname.config'
import * as consts from '@/constants'
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
import { CreateConnectorFn, WagmiProvider, cookieToInitialState, http, type Config } from 'wagmi'

import { coinbaseWallet } from 'wagmi/connectors'

// 0. Setup queryClient
const queryClient = new QueryClient()

// 1. Get projectId at https://cloud.reown.com
const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? ''

// 2. Create wagmiConfig
const metadata = {
    name: 'Peanut Protocol',
    description: 'Peanut protocol - send crypto with links',
    url: process.env.NEXT_PUBLIC_BASE_URL || 'https://peanut.to', // origin must match your domain & subdomain
    icons: [''],
}

// 3. Create transports for each chain
const transports = Object.fromEntries(consts.chains.map((chain) => [chain.id, http(chain.rpcUrls.default.http[0])]))

// 4. Create connectors
const connectors: CreateConnectorFn[] = [
    coinbaseWallet({
        appName: metadata.name,
        appLogoUrl: metadata.icons[0],
    }),
]

export const networks = [arbitrum, mainnet, optimism, polygon, gnosis, base, scroll, mantle, bsc] as [
    AppKitNetwork,
    ...AppKitNetwork[],
]

// 5. Create WagmiAdapter with required properties
const wagmiAdapter = new WagmiAdapter({
    networks,
    projectId,
    // transports,
    // connectors,
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
    const initialState = cookieToInitialState(wagmiAdapter.wagmiConfig as Config, cookies)
    return (
        <WagmiProvider config={wagmiAdapter.wagmiConfig} initialState={initialState}>
            <QueryClientProvider client={queryClient}>
                <JustaNameContext>{children}</JustaNameContext>
            </QueryClientProvider>
        </WagmiProvider>
    )
}
