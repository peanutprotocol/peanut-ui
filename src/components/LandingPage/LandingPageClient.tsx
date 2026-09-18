'use client'

import { useFooterVisibility } from '@/context/footerVisibility'
import { Suspense, useMemo, type ReactNode } from 'react'
// Imported directly, not through the barrel: `export *` pulls every sibling
// into this chunk, including dropLink's nine repeat: Infinity animations,
// which the landing page never renders.
import { Hero } from '@/components/LandingPage/hero'
import { Marquee } from '@/components/LandingPage/marquee'
import { NoFees } from '@/components/LandingPage/noFees'
import { ShhhhhFold } from '@/components/LandingPage/ShhhhhFold'
import dynamic from 'next/dynamic'
import { StickyMobileCTA } from '@/components/LandingPage/StickyMobileCTA'
import underMaintenanceConfig from '@/config/underMaintenance.config'
import type { LandingStrings } from './landingStrings'
import { AppModalProvider } from '@/components/Migration/AppModalProvider'
import { LandingDownloadCta } from './LandingDownloadCta'
import { type CTAButton } from '@/components/LandingPage/landing.types'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { useTranslations } from 'next-intl'
import type { LandingContentHrefs } from './landingContentHrefs'

// Split out: the carousel drags the whole testimonials manifest (~64 KB of
// JSON) into whatever chunk imports it, and it renders far below the fold.
// SSR stays on so crawlers still see the tweets; only the client bundle moves
// off the critical path.
const TweetCarousel = dynamic(() => import('@/components/LandingPage/TweetCarousel'))

type LandingPageClientProps = {
    heroConfig: {
        primaryCta: CTAButton
    }
    marqueeMessages: string[]
    strings: LandingStrings
    contentHrefs: LandingContentHrefs
    // Server-rendered slots
    problemSlot: ReactNode
    mantecaSlot: ReactNode
    regulatedRailsSlot: ReactNode
    yourMoneySlot: ReactNode
    securitySlot: ReactNode
    sendInSecondsSlot: ReactNode
    footerSlot: ReactNode
    /** The FAQ block — static copy, so it is built on the server. */
    faqSlot: ReactNode
}

export function LandingPageClient({
    heroConfig,
    marqueeMessages,
    strings,
    contentHrefs,
    problemSlot,
    mantecaSlot,
    regulatedRailsSlot,
    yourMoneySlot,
    securitySlot,
    sendInSecondsSlot,
    footerSlot,
    faqSlot,
}: LandingPageClientProps) {
    const { isFooterVisible } = useFooterVisibility()
    const migrationOn = useMigrationFlag()
    // the strip under the door fold speaks /shhhhh's vocabulary, not the
    // product one every other strip repeats
    const tDoorMarquee = useTranslations('shhhhh.marquee')
    // Kill switch: the door fold and the closed-beta strip under it are one
    // promise, so they go dark together.
    const doorFoldOn = !underMaintenanceConfig.disableLandingCardFold

    const primaryCta = migrationOn ? undefined : heroConfig.primaryCta

    // Only the words with a real article behind them become links; the rest
    // stay plain text. Words come from the content system's marquee list, so an
    // edit there just drops out of this map and renders unlinked.
    const marqueeProps = useMemo(() => {
        const hrefs: Record<string, string> = {
            'No transfer fees': contentHrefs.pricing,
            USD: contentHrefs.whatAreDigitalDollars,
            EUR: contentHrefs.sendEurosArgentina,
            'USDT/USDC': contentHrefs.stablecoinBalanceVisaMerchants,
            GLOBAL: contentHrefs.supportedGeographies,
            'SELF-CUSTODIAL': contentHrefs.securityCustody,
            // /support is only a permanent redirect to /en/help, so linking it
            // would drop es/pt readers into English while its neighbours stay localized
            '24/7': contentHrefs.help,
        }
        return {
            visible: true,
            message: marqueeMessages.map((word) => (hrefs[word] ? { label: word, href: hrefs[word] } : word)),
        }
    }, [contentHrefs, marqueeMessages])

    const doorMarqueeProps = useMemo(
        () => ({
            visible: true,
            // the whole strip is the door: every word goes to /shhhhh
            message: [
                tDoorMarquee('iykyk'),
                tDoorMarquee('wordTravels'),
                tDoorMarquee('closedBeta'),
                tDoorMarquee('shhhh'),
                tDoorMarquee('peanutClub'),
            ].map((label) => ({ label, href: '/shhhhh' })),
        }),
        [tDoorMarquee]
    )

    return (
        <AppModalProvider>
            <Hero
                primaryCta={primaryCta}
                buttonVisible={!isFooterVisible}
                strings={strings}
                contentHrefs={contentHrefs}
                customCta={migrationOn ? <LandingDownloadCta subtext={heroConfig.primaryCta.subtext} /> : undefined}
            />
            <Marquee {...marqueeProps} />
            {doorFoldOn && (
                <>
                    <ShhhhhFold />
                    <Marquee {...doorMarqueeProps} />
                </>
            )}
            {problemSlot}
            <Marquee {...marqueeProps} />
            {/* Suspense needed: NoFees renders ExchangeRateWidget which uses useSearchParams().
               Without this boundary, the entire LandingPageClient suspends during SSR,
               sending an empty HTML shell to crawlers and killing SEO. */}
            <Suspense>
                <NoFees strings={strings} contentHrefs={contentHrefs} />
            </Suspense>
            <Marquee {...marqueeProps} />
            {yourMoneySlot}
            <Marquee {...marqueeProps} />
            <TweetCarousel strings={strings} />
            <Marquee {...marqueeProps} />
            {regulatedRailsSlot}
            <Marquee {...marqueeProps} />
            {mantecaSlot}
            <Marquee {...marqueeProps} />
            {securitySlot}
            <Marquee {...marqueeProps} />
            {sendInSecondsSlot}
            <Marquee {...marqueeProps} />
            {faqSlot}
            <Marquee {...marqueeProps} />
            {footerSlot}
            <StickyMobileCTA strings={strings} />
        </AppModalProvider>
    )
}
