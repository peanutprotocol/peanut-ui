'use client'
import { ContextProvider } from '@/config'
import peanut from '@squirrel-labs/peanut-sdk'
import { Analytics } from '@vercel/analytics/react'
import countries from 'i18n-iso-countries'
import enLocale from 'i18n-iso-countries/langs/en.json'
import { useEffect } from 'react'
import { Provider as ReduxProvider } from 'react-redux'
import OneSignal from 'react-onesignal'

import store from '@/redux/store'
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

    useEffect(() => {
        // Ensure this code runs only on the client side
        if (typeof window !== 'undefined') {
            const onesignal = OneSignal.init({
                appId: 'c03d7ef9-0c1d-495e-a8a5-044f49ee70d2',
                safari_web_id: 'web.onesignal.auto.5f8d50ad-7ec3-4f1c-a2de-134e8949294e',
                autoResubscribe: true,
                serviceWorkerParam: { scope: '/onesignal/' },
                serviceWorkerPath: 'onesignal/OneSignalSDKWorker.js',
            })
            const init = async () => {
                console.log('onesignal', await onesignal)
            }
            init()
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
