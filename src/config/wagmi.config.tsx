'use client'

import * as consts from '@/consts'

import { createWeb3Modal } from '@web3modal/wagmi/react'
import { defaultWagmiConfig } from '@web3modal/wagmi/react/config'

import { WagmiProvider, createConfig, http } from 'wagmi'
import { coinbaseWallet, injected, safe, walletConnect } from 'wagmi/connectors'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createClient } from 'viem'

// 0. Setup queryClient
const queryClient = new QueryClient()

// 1. Get projectId at https://cloud.walletconnect.com
const projectId = process.env.WC_PROJECT_ID ?? ''

// 2. Create wagmiConfig
const metadata = {
    name: 'Peanut Protocol',
    description: 'Peanut protocol - send crypto with links',
    url: 'https://peanut.to', // origin must match your domain & subdomain
    icons: [''], // TODO: add icon
}

const config = defaultWagmiConfig({
    chains: consts.chains,
    projectId, // required
    metadata, // required
    enableEmail: true, // Optional - true by default
    ssr: true,
    connectors: [
        safe(),
        walletConnect({
            projectId,
        }),
    ],
})

const configx = createConfig({
    chains: consts.chains,
    connectors: [
        safe({
            allowedDomains: [/app.safe.global$/],
            shimDisconnect: true,
        }),
        walletConnect({
            projectId,
            metadata,
            showQrModal: false,
        }),
        coinbaseWallet({
            appName: 'Peanut Protocol',
        }),
        injected({ shimDisconnect: true }),
    ],
    client({ chain }) {
        return createClient({ chain, transport: http() })
    },
    ssr: true,
})

// 3. Create modal
createWeb3Modal({
    wagmiConfig: configx,
    projectId,
    enableAnalytics: true, // Optional - defaults to your Cloud configuration
    themeVariables: {
        '--w3m-border-radius-master': '0px',
        // '--w3m-accent': 'white',
        '--w3m-color-mix': 'white',
    },
    enableOnramp: true,
})

export function ContextProvider({ children }: { children: React.ReactNode }) {
    return (
        <WagmiProvider config={configx}>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </WagmiProvider>
    )
}
