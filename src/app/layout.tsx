import { ClientProviders } from './ClientProviders'
import { type Viewport } from 'next'
import { Roboto_Flex, Sniglet } from 'next/font/google'
import localFont from 'next/font/local'
import Script from 'next/script'
import '../styles/globals.css'
import { PEANUT_API_URL, BASE_URL } from '@/constants/general.consts'
import { CHUNK_ERROR_RECOVERY_SCRIPT } from '@/utils/chunk-error-recovery'
import { NATIVE_APP_READY_SCRIPT } from '@/utils/native-app-ready'
import { isProductionDomain } from '@/constants/seo-route-policy'
import { type Metadata } from 'next'

const baseUrl = BASE_URL || 'https://peanut.me'
// Fail closed on the raw env (see isProductionDomain): BASE_URL deliberately
// falls back to production for links, but that fallback must not make an
// unset preview environment indexable.
const IS_PRODUCTION_DOMAIN = isProductionDomain(process.env.NEXT_PUBLIC_BASE_URL)

export const metadata: Metadata = {
    title: 'Peanut - Send, Spend & Cash Out Digital Dollars',
    description:
        'Peanut is a money app for people who cross borders — send and receive money globally, spend with the Peanut Card, cash in and out through local rails.',
    metadataBase: new URL(baseUrl),
    icons: { icon: '/favicon.ico' },
    keywords:
        'peer-to-peer payments, send money instantly, request money, fast global transfers, remittances, digital dollar transfers, Latin America, Argentina, Brazil, P2P payments, crypto payments, stablecoin, digital dollars',
    // Canonicals belong to leaf pages: a root canonical here would be inherited
    // by app routes and falsely cluster them with the homepage. Index/follow is
    // also the production default, so emit robots metadata only as a staging /
    // preview belt-and-suspenders guard.
    ...(IS_PRODUCTION_DOMAIN ? {} : { robots: { index: false, follow: false } }),
    openGraph: {
        type: 'website',
        title: 'Peanut - Send, Spend & Cash Out Digital Dollars',
        description:
            'Send and receive money instantly with Peanut - a fast, peer-to-peer payments app powered by digital dollars.',
        url: baseUrl,
        siteName: 'Peanut',
        images: [{ url: '/metadata-img.png', width: 1200, height: 630, alt: 'Peanut' }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Peanut - Send, Spend & Cash Out Digital Dollars',
        description:
            'Send and receive money instantly with Peanut - a fast, peer-to-peer payments app powered by digital dollars.',
        images: ['/metadata-img.png'],
        creator: '@joinpeanut',
        site: '@joinpeanut',
    },
    applicationName: process.env.NODE_ENV === 'development' ? 'Peanut Dev' : 'Peanut',
}

// JSON-LD structured data — site-wide schemas (Organization, WebApplication, WebSite)
// FAQPage schema moved to page.tsx (homepage) where it belongs
const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
        {
            '@type': 'Organization',
            '@id': `${baseUrl}/#organization`,
            name: 'Peanut',
            url: baseUrl,
            logo: {
                '@type': 'ImageObject',
                url: `${baseUrl}/metadata-img.png`,
            },
            sameAs: [
                'https://x.com/joinpeanut',
                'https://github.com/peanutprotocol',
                'https://www.linkedin.com/company/peanut-trade/',
            ],
        },
        {
            '@type': 'WebApplication',
            '@id': `${baseUrl}/#app`,
            name: 'Peanut',
            url: baseUrl,
            applicationCategory: 'FinanceApplication',
            operatingSystem: 'Web',
            offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
            },
            description:
                'Send and receive money instantly with Peanut — a fast, peer-to-peer payments app powered by digital dollars.',
        },
        {
            '@type': 'WebSite',
            '@id': `${baseUrl}/#website`,
            name: 'Peanut',
            url: baseUrl,
            publisher: { '@id': `${baseUrl}/#organization` },
        },
    ],
}

const roboto = Roboto_Flex({
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-roboto',
    axes: ['wdth'],
})

// preload: false on the decorative faces — next/font preloads every declared
// family at High priority, and these three render below the fold (2-3 call
// sites each) while competing with the hero image for bandwidth.
const sniglet = Sniglet({
    weight: ['400', '800'],
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-sniglet',
    preload: false,
})

// The .woff2 files are latin + latin-ext subsets of the .ttf sources (built
// with fonttools; roboto-flex additionally instanced down to just the wght
// axis the CSS uses — the full 13-axis variable TTF was 1.6 MB, this is 53 KB).
// The OG image routes still read the .ttf files at runtime (satori needs TTF),
// so don't delete those.
const knerdOutline = localFont({
    src: '../assets/fonts/knerd-outline.woff2',
    variable: '--font-knerd-outline',
    display: 'swap',
    preload: false,
})

const knerdFilled = localFont({
    src: '../assets/fonts/knerd-filled.woff2',
    variable: '--font-knerd-filled',
    display: 'swap',
    preload: false,
})

const robotoFlexBold = localFont({
    src: '../assets/fonts/roboto-flex-bold.woff2',
    variable: '--font-roboto-flex-bold',
    display: 'swap',
})

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    colorScheme: 'light',
    viewportFit: 'cover',
    // Renders <meta name="theme-color">, which Android Chrome applies
    // immediately (browser tab AND installed PWA) and which overrides a
    // cached manifest theme_color — the manifest alone left the status
    // strip black until Chrome's day-scale manifest refresh.
    themeColor: '#FAF4F0',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    // Extract API hostname for DNS prefetch/preconnect (DRY principle)
    const apiHostname = new URL(PEANUT_API_URL).origin

    return (
        <html
            lang="en"
            style={{ colorScheme: 'light' }}
            data-theme="light"
            className={`${roboto.variable} ${knerdOutline.variable} ${knerdFilled.variable} ${sniglet.variable} ${robotoFlexBold.variable}`}
        >
            <head>
                <meta name="color-scheme" content="light" />

                {/* JSON-LD structured data */}
                <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

                {/* AI-readable product description (llms.txt spec) */}
                <link rel="author" type="text/markdown" href="/llms.txt" />

                {/* DNS prefetch for API */}
                <link rel="dns-prefetch" href={apiHostname} />
                <link rel="preconnect" href={apiHostname} crossOrigin="anonymous" />

                {/* OTA app-ready: MUST be a raw inline script and MUST come first — a bundle
                    applied while the app is backgrounded reloads into a process the OS then
                    freezes, and on resume every overdue chunk-load timer rejects at once, so
                    anything behind an import() never runs (see src/utils/native-app-ready.ts).
                    No-op off native: the bridge stub it calls only exists in the WebView. */}
                <script id="native-app-ready" dangerouslySetInnerHTML={{ __html: NATIVE_APP_READY_SCRIPT }} />

                {/* Chunk-load failure recovery: MUST be a raw inline script — error boundaries
                    are lazy chunks themselves and fail to load in the exact conditions that need
                    them, and even next/script beforeInteractive only queues into self.__next_s
                    for Next's bootstrap CHUNK to execute (see src/utils/chunk-error-recovery.ts) */}
                {process.env.NODE_ENV !== 'development' && (
                    <script
                        id="chunk-error-recovery"
                        dangerouslySetInnerHTML={{ __html: CHUNK_ERROR_RECOVERY_SCRIPT }}
                    />
                )}

                {/* Service Worker Registration: Register early for offline support and caching */}
                {/* CRITICAL: Must run before React hydration to enable offline-first PWA */}
                {process.env.NODE_ENV !== 'development' && (
                    <Script id="sw-registration" strategy="beforeInteractive">
                        {`
                            /*
                             * Native: builds before 2026-04 registered the PWA service worker
                             * inside the Capacitor WebView, and those registrations persist in
                             * WebView storage across app updates (the native bundle ships no
                             * sw.js, so they can never self-update — they sit frozen in front of
                             * all GET traffic). Actively evict them; takes effect next launch.
                             */
                            if ('serviceWorker' in navigator && window.Capacitor) {
                                navigator.serviceWorker.getRegistrations()
                                    .then((regs) => regs.forEach((r) => r.unregister()))
                                    .catch(() => {});
                            }
                            if ('serviceWorker' in navigator && !window.Capacitor) {
                                window.addEventListener('load', async () => {
                                    try {
                                        const registration = await navigator.serviceWorker.register('/sw.js', {
                                            scope: '/',
                                            updateViaCache: 'none'
                                        });
                                        console.log('SW registered:', registration.scope);

                                        // Check for SW updates when user returns to app/tab.
                                        // Without this, PWA users can stay on stale SWs indefinitely
                                        // (browser's 24h auto-check is unreliable for backgrounded PWAs).
                                        document.addEventListener('visibilitychange', () => {
                                            if (!document.hidden) {
                                                registration.update();
                                            }
                                        });
                                    } catch (error) {
                                        console.error('SW registration failed:', error);
                                    }
                                });

                                // Reload when new SW takes control (more reliable than statechange).
                                // Guards: (1) refreshing prevents double-reloads, (2) hadController
                                // skips first-ever install (no previous SW = initial registration, not
                                // an update — reloading on first visit would flash/reload for every new
                                // user and SEO crawler), (3) isStandalone skips PWA mode because
                                // window.location.reload() in Android PWA standalone context can break
                                // the standalone session and bounce the user back to Chrome — causing
                                // a PWA ↔ Chrome redirect loop (the new SW still activates via
                                // skipWaiting + clientsClaim, so the user gets new code on next navigation).
                                let refreshing = false;
                                const hadController = !!navigator.serviceWorker.controller;
                                navigator.serviceWorker.addEventListener('controllerchange', () => {
                                    if (refreshing || !hadController) return;
                                    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
                                        || navigator.standalone === true;
                                    if (!isStandalone) {
                                        refreshing = true;
                                        window.location.reload();
                                    }
                                });
                            }
                        `}
                    </Script>
                )}

                {/* Note: Google Tag Manager (gtag.js) does not support version pinning.*/}
                {process.env.NODE_ENV !== 'development' &&
                    process.env.NEXT_PUBLIC_GA_KEY &&
                    process.env.NEXT_PUBLIC_CAPACITOR_BUILD !== 'true' &&
                    process.env.NEXT_PUBLIC_PERF_BARE !== 'true' && (
                        <>
                            {/* lazyOnload, not afterInteractive: Next emits a
                                <link rel="preload"> for afterInteractive scripts, which
                                put 186 KB of gtag.js at High priority ahead of the LCP
                                image. Loading it after `load` keeps the pageview and
                                every downstream event, just off the critical path. */}
                            <Script
                                src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_KEY}`}
                                strategy="lazyOnload"
                            />
                            <Script id="google-analytics" strategy="lazyOnload">
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
            {/* font variable classes live on <html>: @theme vars like --font-sans
                substitute var(--font-roboto) at :root, so the next/font vars must
                be defined there — on <body> the :root substitution fails and every
                font-sans consumer falls back to the system font */}
            <body className="chakra-ui-light font-sans">
                <ClientProviders>{children}</ClientProviders>
            </body>
        </html>
    )
}
