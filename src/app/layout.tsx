'use client'
import '@/styles/globals.css'
import { Inter } from 'next/font/google'
import { Web3Modal } from '@web3modal/react'
import { WagmiConfig } from 'wagmi'

import * as config from '@/config'
import { Store } from '@/store/store'
import { useState, useEffect } from 'react'
import ReactGA from "react-ga4";

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({ children }: { children: React.ReactNode }) {
    const [ready, setReady] = useState(false)

    //this useEffect is needed to prevent hydration error when autoConnect in wagmiConfig is true
    useEffect(() => {
        setReady(true)
        ReactGA.initialize(process.env.GA_KEY ?? "");
    }, [])

    return (
        <html lang="en">
            <title>Peanut Protocol</title>
            <body className={inter.className}>
                {ready && (
                    <WagmiConfig config={config.wagmiConfig}>
                        <Store>{children}</Store>
                    </WagmiConfig>
                )}
                <Web3Modal
                    projectId={process.env.WC_PROJECT_ID ?? ''}
                    ethereumClient={config.ethereumClient}
                    themeMode="dark"
                    themeVariables={{
                        '--w3m-accent-color': 'white',
                        '--w3m-background-color': 'white',
                        '--w3m-accent-fill-color': 'black',
                        '--w3m-container-border-radius': '0px',
                        '--w3m-background-border-radius': '0px',
                    }}
                />
            </body>
        </html>
    )
}
