'use client'

import { useFooterVisibility } from '@/context/footerVisibility'
import { useTranslations } from 'next-intl'
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
import { AppModalProvider } from '@/components/Migration/AppModalProvider'
import { type CTAButton } from '@/components/LandingPage/landing.types'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import type { LandingContentHrefs } from './landingContentHrefs'

// Split out: the carousel drags the whole testimonials manifest (~64 KB of
// JSON) into whatever chunk imports it, and it renders far below the fold.
// SSR stays on so crawlers still see the tweets; only the client bundle moves
// off the critical path.
const TweetCarousel = dynamic(() => import('@/components/LandingPage/TweetCarousel'))

// Same reasoning as the carousel, plus: neither can render before mount, since
// useMigrationFlag is false until then. Statically imported they dragged
// DownloadQR -> QRCodeWrapper -> react-qr-code into the landing page's main
// chunk for every visitor, flag off included.
//
// The same split has to hold on every other path that reaches a QR from this
// page, or it buys nothing: AppModalProvider defers ScanToDownloadModal,
// FooterGetTheApp defers DownloadQR, and SendInSecondsBody defers
// GetTheAppFold. react-qr-code is reachable from the landing page ONLY through
// those four lazy boundaries.
const HeroAppLockup = dynamic(() => import('@/components/LandingPage/HeroAppLockup').then((m) => m.HeroAppLockup), {
    ssr: false,
})
const PhoneAppCta = dynamic(() => import('@/components/LandingPage/PhoneAppCta').then((m) => m.PhoneAppCta), {
    ssr: false,
})

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
    // the strip under the door fold speaks /shhhhh's vocabulary, not the
    // product one every other strip repeats
    const tDoorMarquee = useTranslations('shhhhh.marquee')
    const { deviceType } = useDeviceType()
    const isDesktop = deviceType === DeviceType.WEB
    // Kill switch: the door fold and the closed-beta strip under it are one
    // promise, so they go dark together.
    const doorFoldOn = !underMaintenanceConfig.disableLandingCardFold

    // pwa-sunset hero CTAs are device-based: the whole CTA slot becomes a
    // custom lockup — the S-full QR + store pair on desktop, one full-width
    // download button on phones — so the content-system primary CTA drops out
    // entirely. The permanent flag-off CTA change goes through the content
    // system post-cutover (TASK-20600).
    const primaryCta = migrationOn ? undefined : heroConfig.primaryCta

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
        // one scan-to-download modal for the whole page: every re-pointed CTA
        // below — including the ones inside server-rendered folds — opens this
        // instance and only says which surface it is calling from
        <AppModalProvider>
            <Hero
                primaryCta={primaryCta}
                buttonVisible={buttonVisible}
                strings={strings}
                locale={locale}
                compactArtwork={migrationOn}
                loginToApp={migrationOn}
                customCtaFullWidth={migrationOn && !isDesktop}
                customCta={
                    migrationOn ? (
                        isDesktop ? (
                            <HeroAppLockup strings={strings.migration} subtext={heroConfig.primaryCta.subtext} />
                        ) : (
                            <PhoneAppCta
                                surface={MIGRATION_SURFACES.LANDING_HERO}
                                strings={strings.migration}
                                subtext={heroConfig.primaryCta.subtext}
                                showOtherStore
                            />
                        )
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
        </AppModalProvider>
    )
}
