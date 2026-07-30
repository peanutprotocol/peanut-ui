'use client'

import { useFooterVisibility } from '@/context/footerVisibility'
import { Suspense, useEffect, useMemo, useState, useRef, useCallback, type ReactNode } from 'react'
import { DropLink, FAQs, Hero, Marquee, NoFees, CardPioneers } from '@/components/LandingPage'
import { SupportedRailsFaqAnswer } from '@/components/LandingPage/SupportedRailsFaqAnswer'
import { SUPPORTED_RAILS_FAQ_ID } from '@/constants/faq.consts'
import TweetCarousel from '@/components/LandingPage/TweetCarousel'
import { StickyMobileCTA } from '@/components/LandingPage/StickyMobileCTA'
import underMaintenanceConfig from '@/config/underMaintenance.config'
import ScanToDownloadModal from '@/components/Migration/ScanToDownloadModal'
import { MIGRATION_SURFACES, STORE_URL } from '@/constants/migration.consts'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { trackStoreClick } from '@/utils/migration.utils'

type CTAButton = {
    label: string
    href: string
    isExternal?: boolean
    subtext?: string
    onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
}

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
    mantecaSlot,
    regulatedRailsSlot,
    yourMoneySlot,
    securitySlot,
    sendInSecondsSlot,
    footerSlot,
}: LandingPageClientProps) {
    const { isFooterVisible } = useFooterVisibility()
    const migrationOn = useMigrationFlag()
    const { deviceType } = useDeviceType()
    const [qrModalOpen, setQrModalOpen] = useState(false)

    // pwa-sunset: the hero CTA becomes "Download now" — the visitor's store on
    // mobile, the scan-to-download QR on desktop. English-only like the rest of
    // this surface; the permanent label change goes through the content system
    // post-cutover, at which point this override is deleted (TASK-20600).
    const primaryCta = useMemo((): CTAButton => {
        if (!migrationOn) return heroConfig.primaryCta
        if (deviceType === DeviceType.WEB) {
            return {
                label: 'Download now',
                href: '#',
                onClick: (e) => {
                    e.preventDefault()
                    setQrModalOpen(true)
                },
            }
        }
        const store = deviceType === DeviceType.ANDROID ? 'android' : 'ios'
        return {
            label: 'Download now',
            href: STORE_URL[store],
            isExternal: true,
            // the anchor navigates; only track here
            onClick: () => trackStoreClick(store, MIGRATION_SURFACES.LANDING_HERO),
        }
    }, [migrationOn, deviceType, heroConfig.primaryCta])

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
            <Hero primaryCta={primaryCta} buttonVisible={buttonVisible} buttonScale={buttonScale} />
            {qrModalOpen && (
                <ScanToDownloadModal
                    visible={qrModalOpen}
                    onClose={() => setQrModalOpen(false)}
                    surface={MIGRATION_SURFACES.LANDING_HERO}
                />
            )}
            <Marquee {...marqueeProps} />
            {mantecaSlot}
            <Marquee {...marqueeProps} />
            {yourMoneySlot}
            <Marquee {...marqueeProps} />
            {!underMaintenanceConfig.disableCardPioneers && (
                <>
                    <CardPioneers />
                    <Marquee {...marqueeProps} />
                </>
            )}
            <TweetCarousel />
            <Marquee {...marqueeProps} />
            {regulatedRailsSlot}
            <Marquee {...marqueeProps} />
            <DropLink />
            <Marquee {...marqueeProps} />
            {securitySlot}
            <Marquee {...marqueeProps} />
            <div ref={sendInSecondsRef}>{sendInSecondsSlot}</div>
            <Marquee {...marqueeProps} />
            {/* Suspense needed: NoFees renders ExchangeRateWidget which uses useSearchParams().
               Without this boundary, the entire LandingPageClient suspends during SSR,
               sending an empty HTML shell to crawlers and killing SEO. */}
            <Suspense>
                <NoFees />
            </Suspense>
            <Marquee {...marqueeProps} />
            <FAQs heading={faqData.heading} questions={faqQuestions} marquee={faqData.marquee} />
            <Marquee {...marqueeProps} />
            {footerSlot}
            <StickyMobileCTA />
        </>
    )
}
