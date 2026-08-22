'use client'

import { useFooterVisibility } from '@/context/footerVisibility'
import { Suspense, useEffect, useMemo, useState, useRef, useCallback, type ReactNode } from 'react'
// Imported directly, not through the barrel: `export *` pulls every sibling
// into this chunk, including dropLink's nine repeat: Infinity animations,
// which the landing page never renders.
import { FAQs } from '@/components/LandingPage/faq'
import { Hero } from '@/components/LandingPage/hero'
import { Marquee } from '@/components/LandingPage/marquee'
import { NoFees } from '@/components/LandingPage/noFees'
import { ShhhhhFold } from '@/components/LandingPage/ShhhhhFold'
import { SupportedRailsFaqAnswer } from '@/components/LandingPage/SupportedRailsFaqAnswer'
import { SUPPORTED_RAILS_FAQ_ID } from '@/constants/faq.consts'
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

// Split out: the carousel drags the whole testimonials manifest (~64 KB of
// JSON) into whatever chunk imports it, and it renders far below the fold.
// SSR stays on so crawlers still see the tweets; only the client bundle moves
// off the critical path.
const TweetCarousel = dynamic(() => import('@/components/LandingPage/TweetCarousel'))

type FAQQuestion = {
    id: string
    question: string
    answer: string
}

type LandingPageClientProps = {
    heroConfig: {
        primaryCta: CTAButton
    }
    faqData: {
        heading: string
        questions: FAQQuestion[]
        marquee: { visible: boolean; message: string }
    }
    locale: Locale
    strings: LandingStrings
    // Server-rendered slots
    problemSlot: ReactNode
    mantecaSlot: ReactNode
    regulatedRailsSlot: ReactNode
    yourMoneySlot: ReactNode
    securitySlot: ReactNode
    sendInSecondsSlot: ReactNode
    footerSlot: ReactNode
    /** The word strip, built on the server and rendered at every band break. */
    marqueeSlot: ReactNode
}

export function LandingPageClient({
    heroConfig,
    faqData,
    locale,
    strings,
    problemSlot,
    mantecaSlot,
    regulatedRailsSlot,
    yourMoneySlot,
    securitySlot,
    sendInSecondsSlot,
    footerSlot,
    marqueeSlot,
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

    // Memoized: this component re-renders per scroll frame during the button
    // animation — don't rebuild the FAQ array + rich answer element each time.
    const faqQuestions = useMemo(() => {
        // The questions come from the content system, which must not carry code
        // concerns, so the article each one continues into is mapped here by id.
        // "Why Peanut?" and "My question is not here" are left out on purpose:
        // the first has no single article behind it, the second already links
        // the help centre in its own answer.
        const learnMore: Record<string, string> = {
            '1': `/${locale}/help/what-are-digital-dollars`,
            '2': `/${locale}/help/verification`,
            '3': `/${locale}/help/passkeys`,
            '4': `/${locale}/help/security-custody`,
            '5': `/${locale}/help/fees-pricing`,
            [SUPPORTED_RAILS_FAQ_ID]: `/${locale}/help/supported-geographies`,
        }
        return faqData.questions.map((q) => ({
            ...q,
            ...(q.id === SUPPORTED_RAILS_FAQ_ID
                ? { answerContent: <SupportedRailsFaqAnswer strings={strings.supportedRails} /> }
                : {}),
            ...(learnMore[q.id] ? { learnMoreHref: learnMore[q.id] } : {}),
        }))
    }, [faqData.questions, locale, strings.supportedRails])

    const [buttonVisible, setButtonVisible] = useState(true)
    const [isScrollFrozen, setIsScrollFrozen] = useState(false)
    const [buttonScale, setButtonScale] = useState(1)
    const [animationComplete, setAnimationComplete] = useState(false)
    const [shrinkingPhase, setShrinkingPhase] = useState(false)
    const [hasGrown, setHasGrown] = useState(false)
    const sendInSecondsRef = useRef<HTMLDivElement>(null)
    const frozenScrollY = useRef(0)
    const virtualScrollY = useRef(0)
    const touchStartY = useRef(0)

    // Use refs to avoid re-attaching listeners on every state change
    const isScrollFrozenRef = useRef(isScrollFrozen)
    const animationCompleteRef = useRef(animationComplete)
    const shrinkingPhaseRef = useRef(shrinkingPhase)
    const hasGrownRef = useRef(hasGrown)
    isScrollFrozenRef.current = isScrollFrozen
    animationCompleteRef.current = animationComplete
    shrinkingPhaseRef.current = shrinkingPhase
    hasGrownRef.current = hasGrown

    useEffect(() => {
        if (isFooterVisible) {
            setButtonVisible(false)
        } else {
            setButtonVisible(true)
        }
    }, [isFooterVisible])

    // Shared logic: accumulate virtual scroll delta and animate the button scale
    const handleScrollDelta = useCallback((deltaY: number) => {
        if (!isScrollFrozenRef.current || animationCompleteRef.current) return
        if (deltaY <= 0) return

        virtualScrollY.current += deltaY

        const maxVirtualScroll = 500
        const newScale = Math.min(1.5, 1 + (virtualScrollY.current / maxVirtualScroll) * 0.5)
        setButtonScale(newScale)

        if (newScale >= 1.5) {
            setAnimationComplete(true)
            setHasGrown(true)
            document.body.style.overflow = ''
            setIsScrollFrozen(false)
        }
    }, [])

    useEffect(() => {
        const handleScroll = () => {
            if (sendInSecondsRef.current) {
                const targetElement = document.getElementById('sticky-button-target')
                if (!targetElement) return

                const targetRect = targetElement.getBoundingClientRect()
                const currentScrollY = window.scrollY

                const stickyButtonTop = window.innerHeight - 16 - 52
                const stickyButtonBottom = window.innerHeight - 16

                const shouldFreeze =
                    targetRect.top <= stickyButtonBottom - 60 &&
                    targetRect.bottom >= stickyButtonTop - 60 &&
                    !animationCompleteRef.current &&
                    !shrinkingPhaseRef.current &&
                    !hasGrownRef.current

                if (shouldFreeze && !isScrollFrozenRef.current) {
                    setIsScrollFrozen(true)
                    frozenScrollY.current = currentScrollY
                    virtualScrollY.current = 0
                    document.body.style.overflow = 'hidden'
                    window.scrollTo(0, frozenScrollY.current)
                } else if (isScrollFrozenRef.current && !animationCompleteRef.current) {
                    window.scrollTo(0, frozenScrollY.current)
                } else if (
                    animationCompleteRef.current &&
                    !shrinkingPhaseRef.current &&
                    currentScrollY > frozenScrollY.current + 50
                ) {
                    setShrinkingPhase(true)
                } else if (shrinkingPhaseRef.current) {
                    const shrinkDistance = Math.max(0, currentScrollY - (frozenScrollY.current + 50))
                    const maxShrinkDistance = 200
                    const shrinkProgress = Math.min(1, shrinkDistance / maxShrinkDistance)
                    const newScale = 1.5 - shrinkProgress * 0.5
                    setButtonScale(Math.max(1, newScale))
                } else if (animationCompleteRef.current && currentScrollY < frozenScrollY.current - 100) {
                    setAnimationComplete(false)
                    setShrinkingPhase(false)
                    setButtonScale(1)
                    setHasGrown(false)
                }
            }
        }

        const handleWheel = (event: WheelEvent) => {
            if (isScrollFrozenRef.current && !animationCompleteRef.current) {
                event.preventDefault()
                handleScrollDelta(event.deltaY)
            }
        }

        const handleTouchStart = (event: TouchEvent) => {
            touchStartY.current = event.touches[0].clientY
        }

        const handleTouchMove = (event: TouchEvent) => {
            if (isScrollFrozenRef.current && !animationCompleteRef.current) {
                event.preventDefault()
                const deltaY = touchStartY.current - event.touches[0].clientY
                touchStartY.current = event.touches[0].clientY
                handleScrollDelta(deltaY)
            }
        }

        window.addEventListener('scroll', handleScroll)
        window.addEventListener('wheel', handleWheel, { passive: false })
        window.addEventListener('touchstart', handleTouchStart, { passive: true })
        window.addEventListener('touchmove', handleTouchMove, { passive: false })
        handleScroll()

        return () => {
            window.removeEventListener('scroll', handleScroll)
            window.removeEventListener('wheel', handleWheel)
            window.removeEventListener('touchstart', handleTouchStart)
            window.removeEventListener('touchmove', handleTouchMove)
            document.body.style.overflow = ''
        }
    }, [handleScrollDelta])

    // Memoized for the same reason as faqQuestions above — this component
    // re-renders per scroll frame while the send button grows.
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
                buttonScale={buttonScale}
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
            {marqueeSlot}
            {doorFoldOn && (
                <>
                    <ShhhhhFold />
                    <Marquee {...doorMarqueeProps} />
                </>
            )}
            {problemSlot}
            {marqueeSlot}
            {/* Suspense needed: NoFees renders ExchangeRateWidget which uses useSearchParams().
               Without this boundary, the entire LandingPageClient suspends during SSR,
               sending an empty HTML shell to crawlers and killing SEO. */}
            <Suspense>
                <NoFees locale={locale} strings={strings} />
            </Suspense>
            {marqueeSlot}
            {yourMoneySlot}
            {marqueeSlot}
            <TweetCarousel strings={strings} />
            {marqueeSlot}
            {regulatedRailsSlot}
            {marqueeSlot}
            {mantecaSlot}
            {marqueeSlot}
            {securitySlot}
            {marqueeSlot}
            <div ref={sendInSecondsRef}>{sendInSecondsSlot}</div>
            {marqueeSlot}
            <FAQs
                heading={faqData.heading}
                questions={faqQuestions}
                learnMoreLabel={strings.learnMore}
                marquee={faqData.marquee}
            />
            {marqueeSlot}
            {footerSlot}
            <StickyMobileCTA strings={strings} />
        </>
    )
}
