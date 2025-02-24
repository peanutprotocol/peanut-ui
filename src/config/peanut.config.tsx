'use client'
import * as config from '@/config'
import peanut from '@squirrel-labs/peanut-sdk'
import { Analytics } from '@vercel/analytics/react'
import countries from 'i18n-iso-countries'
import enLocale from 'i18n-iso-countries/langs/en.json'
import { useEffect } from 'react'
import ReactGA from 'react-ga4'
import { Provider as ReduxProvider } from 'react-redux'

import store from '@/redux/store'
import 'react-tooltip/dist/react-tooltip.css'
import '../../sentry.client.config'
import '../../sentry.edge.config'
import '../../sentry.server.config'

export function PeanutProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        ReactGA.initialize(process.env.NEXT_PUBLIC_GA_KEY ?? '')
        peanut.toggleVerbose(true)
        // LogRocket.init('x2zwq1/peanut-protocol')
        countries.registerLocale(enLocale)
    }, [])

    console.log('NODE_ENV:', process.env.NODE_ENV)

    return (
        <ReduxProvider store={store}>
            <config.ContextProvider cookies={null}>
                {children}
                <Analytics />
            </config.ContextProvider>
        </ReduxProvider>
    )
}
