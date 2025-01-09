import { PeanutProvider } from '@/config'
import * as context from '@/context'
import { FooterVisibilityProvider } from '@/context/footerVisibility'
import { Londrina_Solid, Roboto_Flex, Sniglet } from 'next/font/google'
import localFont from 'next/font/local'
import '../styles/globals.css'
import { generateMetadata } from './metadata'

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

const knerdOutline = localFont({
    src: '../assets/fonts/knerd-outline.ttf',
    variable: '--font-knerd-outline',
})

const knerdFilled = localFont({
    src: '../assets/fonts/knerd-filled.ttf',
    variable: '--font-knerd-filled',
})

export const metadata = generateMetadata({
    title: 'Peanut Protocol | Cross-Chain Payment Infrastructure',
    description:
        'Seamless cross-chain payment infrastructure for sending and receiving digital assets. Built for both developers and consumers to abstract away blockchain complexities with chain-agnostic transfers, stablecoin conversions, and fiat offramps.',
    image: '/metadata-img.png',
    keywords:
        'blockchain payments, cross-chain transfers, payment infrastructure, crypto payments, stablecoin conversion, fiat offramp, web3 payments, blockchain protocol',
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body
                className={`${roboto.variable} ${londrina.variable} ${knerdOutline.variable} ${knerdFilled.variable} ${sniglet.variable} chakra-ui-light font-sans`}
            >
                <PeanutProvider>
                    <context.ContextProvider>
                        <FooterVisibilityProvider>{children}</FooterVisibilityProvider>
                    </context.ContextProvider>
                </PeanutProvider>
            </body>
        </html>
    )
}
