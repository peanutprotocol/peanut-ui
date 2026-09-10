'use client'

import { WagmiRoot } from '@/config/wagmi.config'

/**
 * Wagmi, mounted on app routes only and loaded as its own chunk. Nothing the
 * marketing site renders reads it. (The redux store that used to mount here
 * was deleted — TASK-21462.)
 *
 * The query client is deliberately NOT here: the landing page's exchange-rate
 * widget calls `useExchangeRate`, which is a react-query hook, so
 * QueryClientProvider stays above this for every route.
 */
export function AppStateProviders({ children }: { children: React.ReactNode }) {
    return <WagmiRoot cookies={null}>{children}</WagmiRoot>
}
