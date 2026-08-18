'use client'

import { useFooterVisibility } from '@/context/footerVisibility'
import { Suspense, useEffect, useMemo, useState, useRef, useCallback, type ReactNode } from 'react'
import { DropLink, FAQs, Hero, Marquee, NoFees, CardPioneers } from '@/components/LandingPage'
import { SupportedRailsFaqAnswer } from '@/components/LandingPage/SupportedRailsFaqAnswer'
import { SUPPORTED_RAILS_FAQ_ID } from '@/constants/faq.consts'
import TweetCarousel from '@/components/LandingPage/TweetCarousel'
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
    marqueeMessages: string[]
    locale: Locale
    strings: LandingStrings
    // Server-rendered slots
    mantecaSlot: ReactNode
    regulatedRailsSlot: ReactNode
    yourMoneySlot: ReactNode
    securitySlot: ReactNode
    sendInSecondsSlot: ReactNode
    footerSlot: ReactNode
}

export function LandingPageClient({
    heroConfig,
    faqData,
    marqueeMessages,
    locale,
    strings,
    mantecaSlot,
    regulatedRailsSlot,
    yourMoneySlot,
    securitySlot,
    sendInSecondsSlot,
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
    const faqQuestions = useMemo(
        () =>
            faqData.questions.map((q) =>
                q.id === SUPPORTED_RAILS_FAQ_ID ? { ...q, answerContent: <SupportedRailsFaqAnswer /> } : q
            ),
        [faqData.questions]
    )

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

    const marqueeProps = { visible: true, message: marqueeMessages }

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
            <Marquee {...marqueeProps} />
            {mantecaSlot}
            <Marquee {...marqueeProps} />
            {yourMoneySlot}
            <Marquee {...marqueeProps} />
            {!underMaintenanceConfig.disableCardPioneers && (
                <>
                    <CardPioneers strings={strings} />
                    <Marquee {...marqueeProps} />
                </>
            )}
            <TweetCarousel strings={strings} />
            <Marquee {...marqueeProps} />
            {regulatedRailsSlot}
            <Marquee {...marqueeProps} />
            <DropLink strings={strings} />
            <Marquee {...marqueeProps} />
            {securitySlot}
            <Marquee {...marqueeProps} />
            <div ref={sendInSecondsRef}>{sendInSecondsSlot}</div>
            <Marquee {...marqueeProps} />
            {/* Suspense needed: NoFees renders ExchangeRateWidget which uses useSearchParams().
               Without this boundary, the entire LandingPageClient suspends during SSR,
               sending an empty HTML shell to crawlers and killing SEO. */}
            <Suspense>
                <NoFees locale={locale} strings={strings} />
            </Suspense>
            <Marquee {...marqueeProps} />
            <FAQs heading={faqData.heading} questions={faqQuestions} marquee={faqData.marquee} />
            <Marquee {...marqueeProps} />
            {footerSlot}
            <StickyMobileCTA strings={strings} />
        </>
    )
}
