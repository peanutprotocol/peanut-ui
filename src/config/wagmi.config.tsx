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
import { DaimoPayProvider } from '@daimo/pay'
import { DAIMO_THEME } from '@/constants/daimo.consts'

// 0. Setup queryClient
const queryClient = new QueryClient()

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

// 6. Lazy AppKit initialization
// Only initialize when user actually needs to connect external wallet

/**
 * Timeout wrapper to prevent indefinite hangs on network issues
 */
const withTimeout = <T,>(promise: Promise<T>, ms: number, operation: string): Promise<T> => {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${operation} timed out after ${ms}ms`)), ms)),
    ])
}

let initPromise: Promise<void> | null = null

export const initializeAppKit = async (): Promise<void> => {
    // Return existing promise if initialization is in progress or already complete
    if (initPromise) return initPromise

    initPromise = (async () => {
        try {
            // Wrap in timeout to prevent indefinite hangs (network issues, Reown API down)
            await withTimeout(
                Promise.resolve(
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
                ),
                10000, // 10 second timeout
                'Wallet connection initialization'
            )
        } catch (error) {
            // Reset promise on error to allow retry
            initPromise = null
            const message =
                error instanceof Error && error.message.includes('timed out')
                    ? 'Wallet connection timed out. Please check your internet and try again.'
                    : 'Unable to initialize wallet connection. Please check your internet connection.'
            console.warn('AppKit initialization failed (will retry on next attempt):', error)
            throw new Error(message)
        }
    })()

    return initPromise
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
                <DaimoPayProvider
                    options={{ embedGoogleFonts: true, disableMobileInjector: true }}
                    customTheme={DAIMO_THEME}
                >
                    <JustaNameContext>{children}</JustaNameContext>
                </DaimoPayProvider>
            </QueryClientProvider>
        </WagmiProvider>
    )
}
