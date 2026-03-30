'use client'
import { JustaNameContext } from '@/config/justaname.config'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import {
    type AppKitNetwork,
    arbitrum,
    base,
    bsc,
    celo,
    gnosis,
    linea,
    mainnet,
    optimism,
    polygon,
    scroll,
    worldchain,
} from '@reown/appkit/networks'
import { createAppKit } from '@reown/appkit/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, cookieToInitialState, type Config } from 'wagmi'
import { RETRY_STRATEGIES } from '@/utils/retry.utils'

// 0. Setup queryClient with network resilience defaults
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            ...RETRY_STRATEGIES.FAST,
            staleTime: 30 * 1000, // Cache data as fresh for 30s
            gcTime: 5 * 60 * 1000, // Keep inactive queries in memory for 5min
            refetchOnWindowFocus: true, // Refetch stale data when user returns
            refetchOnReconnect: true, // Refetch when connectivity restored
            // Allow queries when offline to read from TanStack Query in-memory cache
            // Service Worker provides additional HTTP API response caching (user data, history, prices)
            networkMode: 'always', // Run queries even when offline (reads from cache)
        },
        mutations: {
            retry: 1, // Total 2 attempts: immediate + 1 retry (conservative for write operations)
            retryDelay: 1000, // Fixed 1s delay
            networkMode: 'online', // Pause mutations while offline (writes require network)
        },
    },
})

// 1. Get projectId at https://cloud.reown.com
const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? ''

// 2. Create wagmiConfig
const metadata = {
    name: 'Peanut',
    description: 'Peanut - global instant money',
    url: process.env.NEXT_PUBLIC_BASE_URL || 'https://peanut.me', // origin must match your domain & subdomain
    icons: [`${process.env.NEXT_PUBLIC_BASE_URL}/favicon.ico`],
}

export const networks = [arbitrum, mainnet, optimism, polygon, gnosis, base, scroll, bsc, linea, worldchain, celo] as [
    AppKitNetwork,
    ...AppKitNetwork[],
]

// 5. Create WagmiAdapter with required properties
const wagmiAdapter = new WagmiAdapter({
    networks,
    projectId,
    ssr: true,
})

// 6. AppKit initialization — single source of truth for createAppKit() config.
// Called from ContextProvider on first client render (NOT at module level).
// Module-level calls access browser APIs and cause Next.js SSR bailout.

let appKitInitialized = false
let initPromise: Promise<void> | null = null

/**
 * Initializes or ensures AppKit is initialized.
 * Safe to call multiple times - will only initialize once successfully.
 *
 * @returns Promise that resolves when AppKit is ready
 */
export const initializeAppKit = async (): Promise<void> => {
    // Already initialized successfully
    if (appKitInitialized) return Promise.resolve()

    // Initialization in progress
    if (initPromise) return initPromise

    initPromise = (async () => {
        try {
            createAppKit({
                adapters: [wagmiAdapter],
                defaultNetwork: mainnet,
                networks,
                metadata,
                projectId,
                features: {
                    analytics: false, // no app-kit analytics plz
                    socials: false,
                    email: false,
                    onramp: true,
                },
                themeVariables: {
                    '--w3m-border-radius-master': '0px',
                    '--w3m-color-mix': 'white',
                },
            })
            appKitInitialized = true
        } catch (error) {
            // Reset promise on error to allow retry
            initPromise = null
            console.warn('AppKit initialization failed (will retry on next attempt):', error)
            throw new Error('Unable to initialize wallet connection. Please check your internet connection.')
        }
    })()

    return initPromise
}

export function ContextProvider({ children, cookies }: { children: React.ReactNode; cookies: string | null }) {
    // Initialize AppKit on first client render (required for useAppKit/useDisconnect hooks).
    // Must NOT run at module level — createAppKit() accesses browser APIs which causes Next.js
    // to emit BAILOUT_TO_CLIENT_SIDE_RENDERING and send an empty HTML shell to crawlers.
    // Note: createAppKit() inside initializeAppKit runs synchronously (no await before it),
    // so AppKit is ready before child hooks execute in the same render pass.
    if (typeof window !== 'undefined') {
        void initializeAppKit().catch(() => {
            // initializeAppKit already resets initPromise and logs — suppress the thrown error
            // so the app can still render without wallet connection
        })
    }

    const initialState = cookieToInitialState(wagmiAdapter.wagmiConfig as Config, cookies)

    return (
        <WagmiProvider config={wagmiAdapter.wagmiConfig} initialState={initialState}>
            <QueryClientProvider client={queryClient}>
                <JustaNameContext>{children}</JustaNameContext>
            </QueryClientProvider>
        </WagmiProvider>
    )
}
