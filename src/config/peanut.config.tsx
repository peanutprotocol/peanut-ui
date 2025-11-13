'use client'
import { ContextProvider } from '@/config'
import PeanutLoading from '@/components/Global/PeanutLoading'
import peanut from '@squirrel-labs/peanut-sdk'
import { Analytics } from '@vercel/analytics/react'
import countries from 'i18n-iso-countries'
import enLocale from 'i18n-iso-countries/langs/en.json'
import { useEffect } from 'react'
import { Provider as ReduxProvider } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'

import store, { persistor } from '@/redux/store'
import 'react-tooltip/dist/react-tooltip.css'
import '../../sentry.client.config'
import '../../sentry.edge.config'
import '../../sentry.server.config'

export function PeanutProvider({ children }: { children: React.ReactNode }) {
    if (process.env.NODE_ENV !== 'development') {
        useEffect(() => {
            peanut.toggleVerbose(true)
            // LogRocket.init('x2zwq1/peanut-protocol')
            countries.registerLocale(enLocale)
        }, [])
    }

    console.log('NODE_ENV:', process.env.NODE_ENV)

    return (
        <ReduxProvider store={store}>
            {/* OFFLINE SUPPORT: PersistGate delays rendering until persisted state is retrieved from localStorage
                This ensures Redux has user data before auth guard runs, enabling instant offline loads
                Shows loading spinner during rehydration to prevent blank screen or race conditions */}
            <PersistGate loading={<PeanutLoading />} persistor={persistor}>
                <ContextProvider cookies={null}>
                    {children}
                    <Analytics />
                </ContextProvider>
            </PersistGate>
        </ReduxProvider>
    )
}
