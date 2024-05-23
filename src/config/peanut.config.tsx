'use client'
import { initWeb3InboxClient } from '@web3inbox/react'
import * as config from '@/config'
import { Analytics } from '@vercel/analytics/react'
import { useEffect } from 'react'
import peanut from '@squirrel-labs/peanut-sdk'
import ReactGA from 'react-ga4'
import Hotjar from '@hotjar/browser'

import '../../sentry.client.config'
import '../../sentry.server.config'
import '../../sentry.edge.config'
import 'react-tooltip/dist/react-tooltip.css'

export function PeanutProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        ReactGA.initialize(process.env.NEXT_PUBLIC_GA_KEY ?? '')
        peanut.toggleVerbose(true)
    }, [])

    initWeb3InboxClient({
        // The project ID and domain you setup in the Domain Setup section
        projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? '',
        domain: 'peanut.to',

        allApps: false,
        logLevel: 'info',
    })

    const siteId = 4995627
    const hotjarVersion = 6
    Hotjar.init(siteId, hotjarVersion)

    return (
        <config.ContextProvider>
            {children}
            <Analytics />
        </config.ContextProvider>
    )
}
