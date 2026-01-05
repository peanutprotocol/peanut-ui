'use client'
import { ContextProvider } from '@/config'
import peanut from '@squirrel-labs/peanut-sdk'
import { Analytics } from '@vercel/analytics/react'
import countries from 'i18n-iso-countries'
import enLocale from 'i18n-iso-countries/langs/en.json'
import { useEffect } from 'react'
import { Provider as ReduxProvider } from 'react-redux'

import store from '@/redux/store'
import 'react-tooltip/dist/react-tooltip.css'
// Note: Sentry configs are auto-loaded by @sentry/nextjs via next.config.js
// DO NOT import them here - it bundles server/edge configs into client code

export function PeanutProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        if (process.env.NODE_ENV !== 'development') {
            peanut.toggleVerbose(true)
            // LogRocket.init('x2zwq1/peanut-protocol')
            countries.registerLocale(enLocale)
        }
    }, [])

    return (
        <ReduxProvider store={store}>
            <ContextProvider cookies={null}>
                {children}
                <Analytics />
            </ContextProvider>
        </ReduxProvider>
    )
}
