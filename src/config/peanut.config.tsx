'use client'
import { useInitWeb3InboxClient } from '@web3inbox/widget-react'
import * as config from '@/config'
import { Store } from '@/store/store'
import { Analytics } from '@vercel/analytics/react'
import { useEffect, useState } from 'react'
import peanut from '@squirrel-labs/peanut-sdk'
import ReactGA from 'react-ga4'

import '../../sentry.client.config'
import '../../sentry.server.config'
import '../../sentry.edge.config'
import 'react-tooltip/dist/react-tooltip.css'

export function PeanutProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        ReactGA.initialize(process.env.GA_KEY ?? '')
        peanut.toggleVerbose(true)
    }, [])

    useInitWeb3InboxClient({
        // The project ID and domain you setup in the Domain Setup section
        projectId: process.env.WC_PROJECT_ID ?? '',
        domain: 'peanut.to',

        // Allow localhost development with "unlimited" mode.
        // This authorizes this dapp to control notification subscriptions for all domains (including `app.example.com`), not just `window.location.host`
        isLimited: false,
    })

    return (
        <>
            <config.ContextProvider>
                <Store>
                    {children}
                    <Analytics />
                </Store>
            </config.ContextProvider>
        </>
    )
}
