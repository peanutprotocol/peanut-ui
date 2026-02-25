'use client'

import { useFooterVisibility } from '@/context/footerVisibility'
import { useEffect, useState, useRef, useCallback, type ReactNode } from 'react'
import { DropLink, FAQs, Hero, Marquee, NoFees, CardPioneers } from '@/components/LandingPage'
import TweetCarousel from '@/components/LandingPage/TweetCarousel'
import underMaintenanceConfig from '@/config/underMaintenance.config'

type CTAButton = {
    label: string
    href: string
    isExternal?: boolean
    subtext?: string
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
            <Hero primaryCta={heroConfig.primaryCta} buttonVisible={buttonVisible} buttonScale={buttonScale} />
            <Marquee {...marqueeProps} />
            {mantecaSlot}
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
            {yourMoneySlot}
            <Marquee {...marqueeProps} />
            <DropLink />
            <Marquee {...marqueeProps} />
            {securitySlot}
            <Marquee {...marqueeProps} />
            <div ref={sendInSecondsRef}>{sendInSecondsSlot}</div>
            <Marquee {...marqueeProps} />
            <NoFees />
            <Marquee {...marqueeProps} />
            <FAQs heading={faqData.heading} questions={faqData.questions} marquee={faqData.marquee} />
            <Marquee {...marqueeProps} />
            {footerSlot}
        </>
    )
}
