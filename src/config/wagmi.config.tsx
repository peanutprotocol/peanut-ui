import * as consts from '@/constants'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { createAppKit } from '@reown/appkit/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { mainnet } from 'viem/chains'
import { CreateConnectorFn, WagmiProvider, http } from 'wagmi'
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

// 5. Create WagmiAdapter with required properties
const wagmiAdapter = new WagmiAdapter({
    networks: consts.chains,
    projectId,
    transports,
    connectors,
    ssr: true,
})

// 6. Create AppKit
createAppKit({
    adapters: [wagmiAdapter],
    defaultNetwork: mainnet,
    networks: consts.chains,
    metadata,
    projectId,
    features: {
        analytics: true,
        email: false,
        socials: false,
        onramp: true,
    },
    themeVariables: {
        '--w3m-border-radius-master': '0px',
        '--w3m-color-mix': 'white',
    },
})

export function ContextProvider({ children }: { children: React.ReactNode }) {
    return (
        <WagmiProvider config={wagmiAdapter.wagmiConfig}>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </WagmiProvider>
    )
}
