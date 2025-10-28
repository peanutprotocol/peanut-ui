import { ConsoleGreeting } from '@/components/Global/ConsoleGreeting'
import { ScreenOrientationLocker } from '@/components/Global/ScreenOrientationLocker'
import { TranslationSafeWrapper } from '@/components/Global/TranslationSafeWrapper'
import { PeanutProvider } from '@/config'
import { ContextProvider } from '@/context'
import { FooterVisibilityProvider } from '@/context/footerVisibility'
import { type Viewport } from 'next'
import { Londrina_Solid, Roboto_Flex, Sniglet } from 'next/font/google'
import localFont from 'next/font/local'
import Script from 'next/script'
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

const robotoFlexBold = localFont({
    src: '../assets/fonts/roboto-flex-bold.ttf',
    variable: '--font-roboto-flex-bold',
})

export const metadata = generateMetadata({
    title: 'Peanut - Instant Global P2P Payments in Digital Dollars',
    description:
        'Send and receive money instantly with Peanut - a fast, peer-to-peer payments app powered by digital dollars. Easily transfer funds across borders. Enjoy cheap, instant remittances and cash out to local banks without technical hassle.',
    image: '/metadata-img.png',
    keywords:
        'peer-to-peer payments, send money instantly, request money, fast global transfers, remittances, digital dollar transfers, Latin America, Argentina, Brazil, P2P payments, crypto payments, stablecoin, digital dollars',
})

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    colorScheme: 'light',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" style={{ colorScheme: 'light' }}>
            <head>
                <meta name="color-scheme" content="light" />
                {process.env.NODE_ENV !== 'development' && process.env.NEXT_PUBLIC_GA_KEY && (
                    <>
                        <Script
                            src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_KEY}`}
                            strategy="afterInteractive"
                        />
                        <Script id="google-analytics" strategy="afterInteractive">
                            {`
                                window.dataLayer = window.dataLayer || [];
                                function gtag(){dataLayer.push(arguments);}
                                gtag('js', new Date());
                                gtag('config', '${process.env.NEXT_PUBLIC_GA_KEY}');
                            `}
                        </Script>
                    </>
                )}
            </head>
            <body
                className={`${roboto.variable} ${londrina.variable} ${knerdOutline.variable} ${knerdFilled.variable} ${sniglet.variable} ${robotoFlexBold.variable} chakra-ui-light font-sans`}
            >
                <ConsoleGreeting />
                <ScreenOrientationLocker />
                <PeanutProvider>
                    <ContextProvider>
                        <FooterVisibilityProvider>
                            <TranslationSafeWrapper>{children}</TranslationSafeWrapper>
                        </FooterVisibilityProvider>
                    </ContextProvider>
                </PeanutProvider>
            </body>
        </html>
    )
}
