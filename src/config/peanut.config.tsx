'use client'
import { initWeb3InboxClient } from '@web3inbox/react'
import * as config from '@/config'
import { Analytics } from '@vercel/analytics/react'
import { useEffect } from 'react'
import peanut from '@squirrel-labs/peanut-sdk'
import ReactGA from 'react-ga4'
import countries from 'i18n-iso-countries'
import enLocale from 'i18n-iso-countries/langs/en.json'

import '../../sentry.client.config'
import '../../sentry.server.config'
import '../../sentry.edge.config'
import 'react-tooltip/dist/react-tooltip.css'
import LogRocket from 'logrocket'
import { ChakraProvider } from '@chakra-ui/react'
import * as styles from '@/styles/theme'
import { useUser } from '@/hooks/useUser'

export function PeanutProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        ReactGA.initialize(process.env.NEXT_PUBLIC_GA_KEY ?? '')
        peanut.toggleVerbose(true)
        LogRocket.init('x2zwq1/peanut-protocol')
        countries.registerLocale(enLocale)
    }, [])

    initWeb3InboxClient({
        // The project ID and domain you setup in the Domain Setup section
        projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? '',
        domain: 'peanut.to',

        allApps: false,
        logLevel: 'info',
    })

    return (
        <config.ContextProvider>
            <ChakraProvider theme={styles.theme}> {children}</ChakraProvider>
            <Analytics />
        </config.ContextProvider>
    )
}
