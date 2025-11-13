'use client'
import '@/utils/crypto-polyfill' // Polyfill crypto.randomUUID for DaimoPayProvider
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

// 0. Setup queryClient with network resilience defaults
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // NETWORK RESILIENCE: Retry configuration for improved reliability
            retry: 2, // Total 3 attempts: immediate + 2 retries
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Exponential backoff: 1s, 2s, 5s max
            staleTime: 30 * 1000, // Cache data as fresh for 30s
            gcTime: 5 * 60 * 1000, // Keep inactive queries in memory for 5min
            refetchOnWindowFocus: true, // Refetch stale data when user returns
            refetchOnReconnect: true, // Refetch when connectivity restored
            networkMode: 'online', // Pause queries while offline
        },
        mutations: {
            // NETWORK RESILIENCE: Conservative retry for write operations
            retry: 1, // Total 2 attempts: immediate + 1 retry
            retryDelay: 1000, // Fixed 1s delay
            networkMode: 'online', // Pause mutations while offline
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

// 6. AppKit initialization with SSR compatibility and PWA resilience
// Strategy:
// - Initialize eagerly for SSR (Next.js prerendering requires it)
// - Handle PWA cold launch failures gracefully with retry mechanism

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

// Initialize AppKit (required for components using useAppKit/useDisconnect hooks)
// Components on critical paths (TokenSelector, PaymentForm, home page) need this
// Note: createAppKit() itself is lightweight - expensive network requests (wallet icons,
// analytics) only happen when user actually opens the modal
try {
    createAppKit({
        adapters: [wagmiAdapter],
        defaultNetwork: mainnet,
        networks,
        metadata,
        projectId,
        features: {
            analytics: false, // Disable Coinbase analytics tracking
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
    console.warn('AppKit initialization failed:', error)
}

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
