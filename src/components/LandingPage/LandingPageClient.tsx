'use client'

import { useFooterVisibility } from '@/context/footerVisibility'
import { useEffect, useState, useRef, type ReactNode } from 'react'
import {
    DropLink,
    FAQs,
    Hero,
    Marquee,
    NoFees,
    CardPioneers,
} from '@/components/LandingPage'
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

    useEffect(() => {
        if (isFooterVisible) {
            setButtonVisible(false)
        } else {
            setButtonVisible(true)
        }
    }, [isFooterVisible])

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
                    !animationComplete &&
                    !shrinkingPhase &&
                    !hasGrown

                if (shouldFreeze && !isScrollFrozen) {
                    setIsScrollFrozen(true)
                    frozenScrollY.current = currentScrollY
                    virtualScrollY.current = 0
                    document.body.style.overflow = 'hidden'
                    window.scrollTo(0, frozenScrollY.current)
                } else if (isScrollFrozen && !animationComplete) {
                    window.scrollTo(0, frozenScrollY.current)
                } else if (animationComplete && !shrinkingPhase && currentScrollY > frozenScrollY.current + 50) {
                    setShrinkingPhase(true)
                } else if (shrinkingPhase) {
                    const shrinkDistance = Math.max(0, currentScrollY - (frozenScrollY.current + 50))
                    const maxShrinkDistance = 200
                    const shrinkProgress = Math.min(1, shrinkDistance / maxShrinkDistance)
                    const newScale = 1.5 - shrinkProgress * 0.5
                    setButtonScale(Math.max(1, newScale))
                } else if (animationComplete && currentScrollY < frozenScrollY.current - 100) {
                    setAnimationComplete(false)
                    setShrinkingPhase(false)
                    setButtonScale(1)
                    setHasGrown(false)
                }

            }
        }

        const handleWheel = (event: WheelEvent) => {
            if (isScrollFrozen && !animationComplete) {
                event.preventDefault()

                if (event.deltaY > 0) {
                    virtualScrollY.current += event.deltaY

                    const maxVirtualScroll = 500
                    const newScale = Math.min(1.5, 1 + (virtualScrollY.current / maxVirtualScroll) * 0.5)
                    setButtonScale(newScale)

                    if (newScale >= 1.5) {
                        setAnimationComplete(true)
                        setHasGrown(true)
                        document.body.style.overflow = ''
                        setIsScrollFrozen(false)
                    }
                }
            }
        }

        window.addEventListener('scroll', handleScroll)
        window.addEventListener('wheel', handleWheel, { passive: false })
        handleScroll()

        return () => {
            window.removeEventListener('scroll', handleScroll)
            window.removeEventListener('wheel', handleWheel)
            document.body.style.overflow = ''
        }
    }, [isScrollFrozen, animationComplete, shrinkingPhase, hasGrown])

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
            <div ref={sendInSecondsRef}>
                {sendInSecondsSlot}
            </div>
            <Marquee {...marqueeProps} />
            <NoFees />
            <Marquee {...marqueeProps} />
            <FAQs heading={faqData.heading} questions={faqData.questions} marquee={faqData.marquee} />
            <Marquee {...marqueeProps} />
            {footerSlot}
        </>
    )
}
