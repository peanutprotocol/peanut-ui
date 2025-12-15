import { ClientProviders } from './ClientProviders'
import { type Viewport } from 'next'
import { Londrina_Solid, Roboto_Flex, Sniglet } from 'next/font/google'
import localFont from 'next/font/local'
import Script from 'next/script'
import '../styles/globals.css'
import { PEANUT_API_URL, BASE_URL } from '@/constants/general.consts'
import { type Metadata } from 'next'

const baseUrl = BASE_URL || 'https://peanut.me'

export const metadata: Metadata = {
    title: 'Peanut - Instant Global P2P Payments in Digital Dollars',
    description:
        'Send and receive money instantly with Peanut - a fast, peer-to-peer payments app powered by digital dollars. Easily transfer funds across borders. Enjoy cheap, instant remittances and cash out to local banks without technical hassle.',
    metadataBase: new URL(baseUrl),
    icons: { icon: '/favicon.ico' },
    keywords:
        'peer-to-peer payments, send money instantly, request money, fast global transfers, remittances, digital dollar transfers, Latin America, Argentina, Brazil, P2P payments, crypto payments, stablecoin, digital dollars',
    openGraph: {
        type: 'website',
        title: 'Peanut - Instant Global P2P Payments in Digital Dollars',
        description:
            'Send and receive money instantly with Peanut - a fast, peer-to-peer payments app powered by digital dollars.',
        url: baseUrl,
        siteName: 'Peanut',
        images: [{ url: '/metadata-img.png', width: 1200, height: 630, alt: 'Peanut' }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Peanut - Instant Global P2P Payments in Digital Dollars',
        description:
            'Send and receive money instantly with Peanut - a fast, peer-to-peer payments app powered by digital dollars.',
        images: ['/metadata-img.png'],
        creator: '@PeanutProtocol',
        site: '@PeanutProtocol',
    },
    applicationName: process.env.NODE_ENV === 'development' ? 'Peanut Dev' : 'Peanut',
}

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

                {/* DNS prefetch for API */}
                <link rel="dns-prefetch" href={apiHostname} />
                <link rel="preconnect" href={apiHostname} crossOrigin="anonymous" />

                {/* Prefetch /qr-pay route - disabled in dev to avoid 9s+ compile time */}
                {process.env.NODE_ENV !== 'development' && <link rel="prefetch" href="/qr-pay" />}

                {/* Service Worker Registration: Register early for offline support and caching */}
                {/* CRITICAL: Must run before React hydration to enable offline-first PWA */}
                {process.env.NODE_ENV !== 'development' && (
                    <Script id="sw-registration" strategy="beforeInteractive">
                        {`
                            if ('serviceWorker' in navigator) {
                                window.addEventListener('load', async () => {
                                    try {
                                        // Register service worker - skipWaiting & clientsClaim handle updates
                                        const registration = await navigator.serviceWorker.register('/sw.js', {
                                            scope: '/',
                                            updateViaCache: 'none'
                                        });
                                        console.log('SW registered:', registration.scope);
                                        
                                        // Handle updates: reload page when new SW is waiting
                                        registration.addEventListener('updatefound', () => {
                                            const newWorker = registration.installing;
                                            if (newWorker) {
                                                newWorker.addEventListener('statechange', () => {
                                                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                                        // New SW installed, reload to activate
                                                        console.log('New SW available, reloading...');
                                                        window.location.reload();
                                                    }
                                                });
                                            }
                                        });
                                    } catch (error) {
                                        console.error('SW registration failed:', error);
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
                <ClientProviders>{children}</ClientProviders>
            </body>
        </html>
    )
}
