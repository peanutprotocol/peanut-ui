'use client'

import { useFooterVisibility } from '@/context/footerVisibility'
import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
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
import type { Locale } from '@/i18n/types'
import StoreBadges from '@/components/Migration/StoreBadges'
import { type CTAButton } from '@/components/LandingPage/landing.types'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { useTranslations } from 'next-intl'
import { onStoreAnchorClick, storeAnchorHref } from '@/utils/migration.utils'
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
    locale: Locale
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
    locale,
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
    // app-locale translation (LatAm-first funnel); the flag-off label still
    // comes from the content system per landing locale
    const tMigration = useTranslations('migration')
    // the strip under the door fold speaks /shhhhh's vocabulary, not the
    // product one every other strip repeats
    const tDoorMarquee = useTranslations('shhhhh.marquee')
    const { deviceType } = useDeviceType()
    const isDesktop = deviceType === DeviceType.WEB
    // Kill switch: the door fold and the closed-beta strip under it are one
    // promise, so they go dark together.
    const doorFoldOn = !underMaintenanceConfig.disableLandingCardFold

    // pwa-sunset hero CTAs are device-based: phones get one "Download now"
    // with their store's mark deep-linking to it; desktop drops the primary
    // and shows the equal store-button pair instead (customCta below).
    // the permanent flag-off CTA change goes through the content system
    // post-cutover (TASK-20600).
    const primaryCta = useMemo((): CTAButton | undefined => {
        if (!migrationOn) return heroConfig.primaryCta
        if (isDesktop) return undefined
        const store = deviceType === DeviceType.ANDROID ? 'android' : 'ios'
        return {
            label: tMigration('downloadNow'),
            href: storeAnchorHref(store),
            isExternal: true,
            icon: store === 'ios' ? 'apple-logo' : 'google-play',
            // keep the content-system subtext (e.g. "Join +10,000 cool people")
            subtext: heroConfig.primaryCta.subtext,
            // the anchor navigates itself (works even where window.open is
            // suppressed — in-app browsers); android's hand-off rides the href,
            // ios' rides the clipboard written here inside the tap
            onClick: () => onStoreAnchorClick(store, MIGRATION_SURFACES.LANDING_HERO),
        }
    }, [migrationOn, deviceType, isDesktop, heroConfig.primaryCta, tMigration])

    const [buttonVisible, setButtonVisible] = useState(true)

    useEffect(() => {
        if (isFooterVisible) {
            setButtonVisible(false)
        } else {
            setButtonVisible(true)
        }
    }, [isFooterVisible])

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
        <>
            <Hero
                primaryCta={primaryCta}
                buttonVisible={buttonVisible}
                strings={strings}
                locale={locale}
                customCta={
                    migrationOn && isDesktop ? (
                        <div className="flex flex-col items-center">
                            <StoreBadges surface={MIGRATION_SURFACES.LANDING_HERO} appearance="hero" />
                            {heroConfig.primaryCta.subtext && (
                                <span className="mt-2 block text-center text-sm text-n-1 italic md:text-base">
                                    {heroConfig.primaryCta.subtext}
                                </span>
                            )}
                        </div>
                    ) : undefined
                }
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
        </>
    )
}
