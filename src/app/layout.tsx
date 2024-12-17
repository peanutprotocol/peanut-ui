import '@/styles/globals.css'
import { Roboto_Flex, Londrina_Solid, Sniglet } from 'next/font/google'
import CrispChat from '../components/CrispChat'
import { PeanutProvider } from '@/config'
import * as context from '@/context'
import { FooterVisibilityProvider } from '@/context/footerVisibility'
import { Metadata } from 'next'

const roboto = Roboto_Flex({
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-roboto',
    axes: ['wdth'],
})

const londrina = Londrina_Solid({
    weight: ['400', '900'],
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-londrina',
})

const sniglet = Sniglet({
    weight: ['400', '800'],
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-sniglet',
})

export const metadata: Metadata = {
    title: 'Peanut Protocol | Cross-Chain Payment Infrastructure',
    description:
        'Seamless cross-chain payment infrastructure for sending and receiving digital assets. Built for both developers and consumers to abstract away blockchain complexities with chain-agnostic transfers, stablecoin conversions, and fiat offramps.',
    metadataBase: new URL('https://peanut.to'),
    keywords:
        'blockchain payments, cross-chain transfers, payment infrastructure, crypto payments, stablecoin conversion, fiat offramp, web3 payments, blockchain protocol',

    openGraph: {
        type: 'website',
        title: 'Peanut Protocol | Cross-Chain Payment Infrastructure',
        description:
            'Blockchain payment infrastructure enabling seamless cross-chain transfers, stablecoin conversions, and fiat offramps.',
        url: 'https://peanut.to',
        siteName: 'Peanut Protocol',
        images: [
            {
                url: '/metadata-img.png',
                width: 1200,
                height: 630,
                alt: 'Peanut Protocol - Cross-Chain Payment Infrastructure',
            },
        ],
    },

    twitter: {
        card: 'summary_large_image',
        title: 'Peanut Protocol | Cross-Chain Payment Infrastructure',
        description:
            'Blockchain payment infrastructure enabling seamless cross-chain transfers, stablecoin conversions, and fiat offramps.',
        images: ['/metadata-img.png'],
        creator: '@PeanutProtocol',
        site: '@PeanutProtocol',
    },
    icons: {
        icon: '/favicon.ico',
    },
    viewport: {
        width: 'device-width',
        initialScale: 1,
        maximumScale: 1,
        userScalable: false,
    },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body className={`${roboto.variable} ${londrina.variable} ${sniglet.variable} chakra-ui-light font-sans`}>
                <PeanutProvider>
                    <context.ContextProvider>
                        <FooterVisibilityProvider>
                            {children}
                            <CrispChat />
                        </FooterVisibilityProvider>
                    </context.ContextProvider>
                </PeanutProvider>
            </body>
        </html>
    )
}
