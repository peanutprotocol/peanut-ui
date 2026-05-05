'use client'
import { JustaNameContext } from '@/config/justaname.config'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, cookieToInitialState, createConfig, http, type Config } from 'wagmi'
import { arbitrum, base, bsc, celo, gnosis, linea, mainnet, optimism, polygon, scroll, worldchain } from 'wagmi/chains'
import { RETRY_STRATEGIES } from '@/utils/retry.utils'

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

export const networks = [arbitrum, mainnet, optimism, polygon, gnosis, base, scroll, bsc, linea, worldchain, celo]

export const wagmiConfig = createConfig({
    chains: [arbitrum, mainnet, optimism, polygon, gnosis, base, scroll, bsc, linea, worldchain, celo],
    ssr: true,
    transports: {
        [arbitrum.id]: http(),
        [mainnet.id]: http(),
        [optimism.id]: http(),
        [polygon.id]: http(),
        [gnosis.id]: http(),
        [base.id]: http(),
        [scroll.id]: http(),
        [bsc.id]: http(),
        [linea.id]: http(),
        [worldchain.id]: http(),
        [celo.id]: http(),
    },
})

export function ContextProvider({ children, cookies }: { children: React.ReactNode; cookies: string | null }) {
    const initialState = cookieToInitialState(wagmiConfig as Config, cookies)

    return (
        <WagmiProvider config={wagmiConfig} initialState={initialState}>
            <QueryClientProvider client={queryClient}>
                <JustaNameContext>{children}</JustaNameContext>
            </QueryClientProvider>
        </WagmiProvider>
    )
}
