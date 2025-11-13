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
import { PEANUT_API_URL } from '@/constants/general.consts'

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
    // Extract API hostname for DNS prefetch/preconnect (DRY principle)
    const apiHostname = new URL(PEANUT_API_URL).origin

    return (
        <html lang="en" style={{ colorScheme: 'light' }} data-theme="light">
            <head>
                <meta name="color-scheme" content="light" />

                {/* CRITICAL PATH: Optimize QR payment flow loading */}
                {/* Prefetch /qr-pay route + DNS for Manteca API */}
                <link rel="prefetch" href="/qr-pay" />
                <link rel="dns-prefetch" href={apiHostname} />
                <link rel="preconnect" href={apiHostname} crossOrigin="anonymous" />

                {/* Service Worker Registration: Register early for offline support and caching */}
                {/* CRITICAL: Must run before React hydration to enable offline-first PWA */}
                {process.env.NODE_ENV !== 'development' && (
                    <Script id="sw-registration" strategy="beforeInteractive">
                        {`
                            if ('serviceWorker' in navigator) {
                                window.addEventListener('load', async () => {
                                    try {
                                        // CLEANUP: Unregister old/broken service workers before registering new one
                                        // Fixes issue where multiple broken SWs accumulate and cause "no-response" errors
                                        const registrations = await navigator.serviceWorker.getRegistrations();
                                        if (registrations.length > 0) {
                                            console.log('Found existing SW registrations:', registrations.length);
                                            await Promise.all(registrations.map(reg => {
                                                console.log('Unregistering old SW:', reg.scope);
                                                return reg.unregister();
                                            }));
                                        }
                                        
                                        // Register fresh service worker
                                        const registration = await navigator.serviceWorker.register('/sw.js', {
                                            scope: '/',
                                            updateViaCache: 'none'
                                        });
                                        console.log('✅ SW registered successfully:', registration.scope);
                                    } catch (error) {
                                        console.error('❌ SW registration failed:', error);
                                    }
                                });
                            }
                        `}
                    </Script>
                )}

                {/* Note: Google Tag Manager (gtag.js) does not support version pinning.*/}
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
