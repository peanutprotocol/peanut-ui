'use client'

import { useFooterVisibility } from '@/context/footerVisibility'
import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import { FAQs } from '@/components/LandingPage/faq'
import { Hero } from '@/components/LandingPage/hero'
import { Marquee } from '@/components/LandingPage/marquee'
import { CardBeat } from '@/components/LandingPage/CardBeat'
import { Manifesto } from '@/components/LandingPage/Manifesto'
import { ProblemProse } from '@/components/LandingPage/ProblemProse'
import { WorksToday } from '@/components/LandingPage/WorksToday'
import { NotForYou } from '@/components/LandingPage/NotForYou'
import { SupportedRailsFaqAnswer } from '@/components/LandingPage/SupportedRailsFaqAnswer'
import { SUPPORTED_RAILS_FAQ_ID } from '@/constants/faq.consts'
import { StickyMobileCTA } from '@/components/LandingPage/StickyMobileCTA'
import type { LandingStrings } from './landingStrings'
import type { Locale } from '@/i18n/types'
import StoreBadges from '@/components/Migration/StoreBadges'
import { type CTAButton } from '@/components/LandingPage/landing.types'
import { MIGRATION_SURFACES, STORE_URL } from '@/constants/migration.consts'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { useTranslations } from 'next-intl'
import { trackStoreClick } from '@/utils/migration.utils'

type FAQQuestion = {
    id: string
    question: string
    answer: string
}

// The first strip runs a short set instead of the full content-system one, so
// the words stay readable next to the hero. Picked out of that same set rather
// than hardcoded, so editing content/landing/*.md still moves them.
const FIRST_STRIP_WORDS = ['Instant', '24/7', 'USD', 'EUR', 'GLOBAL']

type LandingPageClientProps = {
    heroConfig: {
        primaryCta: CTAButton
    }
    faqData: {
        heading: string
        questions: FAQQuestion[]
        marquee: { visible: boolean; message: string }
    }
    marqueeMessages: string[]
    locale: Locale
    strings: LandingStrings
    // Server-rendered slots
    footerSlot: ReactNode
}

export function LandingPageClient({
    heroConfig,
    faqData,
    marqueeMessages,
    locale,
    strings,
    footerSlot,
}: LandingPageClientProps) {
    const { isFooterVisible } = useFooterVisibility()
    const migrationOn = useMigrationFlag()
    // app-locale translation (LatAm-first funnel); the flag-off label still
    // comes from the content system per landing locale
    const tMigration = useTranslations('migration')
    const { deviceType } = useDeviceType()
    const isDesktop = deviceType === DeviceType.WEB

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
            href: STORE_URL[store],
            isExternal: true,
            icon: store === 'ios' ? 'apple-logo' : 'google-play',
            // keep the content-system subtext (e.g. "Join +10,000 cool people")
            subtext: heroConfig.primaryCta.subtext,
            // the anchor navigates; only track here
            onClick: () => trackStoreClick(store, MIGRATION_SURFACES.LANDING_HERO),
        }
    }, [migrationOn, deviceType, isDesktop, heroConfig.primaryCta, tMigration])

    // Memoized so the rich answer element isn't rebuilt on every render.
    const faqQuestions = useMemo(
        () =>
            faqData.questions.map((q) =>
                q.id === SUPPORTED_RAILS_FAQ_ID ? { ...q, answerContent: <SupportedRailsFaqAnswer /> } : q
            ),
        [faqData.questions]
    )

    const [buttonVisible, setButtonVisible] = useState(true)

    useEffect(() => {
        if (isFooterVisible) {
            setButtonVisible(false)
        } else {
            setButtonVisible(true)
        }
    }, [isFooterVisible])

    const marqueeProps = { visible: true, message: marqueeMessages }
    const firstStripWords = marqueeMessages.filter((message) => FIRST_STRIP_WORDS.includes(message))
    const firstStripProps = { visible: true, message: firstStripWords.length ? firstStripWords : marqueeMessages }

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
                                <span className="mt-2 block text-center text-sm italic text-n-1 md:text-base">
                                    {heroConfig.primaryCta.subtext}
                                </span>
                            )}
                        </div>
                    ) : undefined
                }
            />
            <Marquee {...firstStripProps} />
            <CardBeat strings={strings} />
            <Marquee visible message={strings.marqueeClosedBeta} />
            <Manifesto strings={strings} />
            <ProblemProse strings={strings} />
            <Marquee {...marqueeProps} />
            {/* Suspense needed: WorksToday renders ExchangeRateWidget which uses useSearchParams().
               Without this boundary, the entire LandingPageClient suspends during SSR,
               sending an empty HTML shell to crawlers and killing SEO. */}
            <Suspense>
                <WorksToday strings={strings} locale={locale} />
            </Suspense>
            <Marquee {...marqueeProps} />
            <NotForYou strings={strings} />
            <Marquee {...marqueeProps} />
            <FAQs heading={faqData.heading} questions={faqQuestions} marquee={faqData.marquee} />
            {footerSlot}
            <StickyMobileCTA strings={strings} />
        </>
    )
}
