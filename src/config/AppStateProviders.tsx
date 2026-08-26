'use client'

import { Provider as ReduxProvider } from 'react-redux'
import store from '@/redux/store'
import { WagmiRoot } from '@/config/wagmi.config'

/**
 * The redux store and wagmi, mounted on app routes only and loaded as their own
 * chunk. Nothing the marketing site renders reads either.
 *
 * The query client is deliberately NOT here: the landing page's exchange-rate
 * widget calls `useExchangeRate`, which is a react-query hook, so
 * QueryClientProvider stays above this for every route.
 */
export function AppStateProviders({ children }: { children: React.ReactNode }) {
    return (
        <ReduxProvider store={store}>
            <WagmiRoot cookies={null}>{children}</WagmiRoot>
        </ReduxProvider>
    )
}
