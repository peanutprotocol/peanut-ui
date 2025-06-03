import { PeanutProvider } from '@/config'
import * as context from '@/context'
import { FooterVisibilityProvider } from '@/context/footerVisibility'
import '@/styles/globals.css'
import { Londrina_Solid, Roboto_Flex, Sniglet } from 'next/font/google'
import Script from 'next/script'
import CrispChat from '../components/CrispChat'
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
            <head>
                <Script id="google-tag-manager" strategy="afterInteractive">
                    {`
                        (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                        new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                        'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                        })(window,document,'script','dataLayer','GTM-5MGHBCQ9');
                    `}
                </Script>
            </head>
            <body className={`${roboto.variable} ${londrina.variable} ${sniglet.variable} chakra-ui-light font-sans`}>
                <noscript>
                    <iframe
                        src="https://www.googletagmanager.com/ns.html?id=GTM-5MGHBCQ9"
                        height="0"
                        width="0"
                        style={{ display: 'none', visibility: 'hidden' }}
                    ></iframe>
                </noscript>
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
