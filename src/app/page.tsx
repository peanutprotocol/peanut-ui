'use client'

import Layout from '@/components/Global/Layout'
import {
    BusinessIntegrate,
    FAQs,
    Hero,
    NoFees,
    SecurityBuiltIn,
    SendInSeconds,
    YourMoney,
} from '@/components/LandingPage'
import { MarqueeComp } from '@/components/Global/MarqueeWrapper'
import { HandThumbsUp } from '@/assets'
import { useFooterVisibility } from '@/context/footerVisibility'
import { useEffect, useState, useRef } from 'react'

export default function LandingPage() {
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
    const previousScrollY = useRef(0)

    const hero = {
        heading: 'Peanut',
        marquee: {
            message: ['No fees', 'Instant', '24/7', 'USD', 'EUR', 'CRYPTO', 'GLOBAL', 'SELF-CUSTODIAL'],
        },
        primaryCta: {
            label: 'TRY NOW',
            href: '/setup',
        },
    }

    const faqs = {
        heading: 'Faqs',
        questions: [
            {
                id: '0',
                question: 'Why Peanut?',
                answer: `It's time to take control of your money. No banks, no borders. Just buttery smooth global money.`,
            },
            {
                id: '1',
                question: 'What is Peanut?',
                answer: 'Peanut is the simplest way to send and receive crypto or fiat. Peanut lets you request, send and cashout digital dollars using links and QR codes.',
            },
        ],
        marquee: {
            visible: false,
            message: 'Peanut',
        },
    }

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

                // Check if the sticky button should "freeze" at the target position
                // Calculate where the sticky button currently is (bottom-4 = 16px from bottom)
                const stickyButtonTop = window.innerHeight - 16 - 52 // 16px bottom margin, ~52px button height
                const stickyButtonBottom = window.innerHeight - 16

                // Freeze when the target element overlaps with the sticky button position (even lower)
                const shouldFreeze =
                    targetRect.top <= stickyButtonBottom - 60 &&
                    targetRect.bottom >= stickyButtonTop - 60 &&
                    !animationComplete &&
                    !shrinkingPhase &&
                    !hasGrown

                if (shouldFreeze && !isScrollFrozen) {
                    // Start freeze - prevent normal scrolling
                    setIsScrollFrozen(true)
                    frozenScrollY.current = currentScrollY
                    virtualScrollY.current = 0
                    document.body.style.overflow = 'hidden'
                    window.scrollTo(0, frozenScrollY.current)
                } else if (isScrollFrozen && !animationComplete) {
                    // During freeze - maintain scroll position
                    window.scrollTo(0, frozenScrollY.current)
                } else if (animationComplete && !shrinkingPhase && currentScrollY > frozenScrollY.current + 50) {
                    // Start shrinking phase when user scrolls further after animation complete
                    setShrinkingPhase(true)
                } else if (shrinkingPhase) {
                    // Shrink button back to original size based on scroll distance
                    const shrinkDistance = Math.max(0, currentScrollY - (frozenScrollY.current + 50))
                    const maxShrinkDistance = 200
                    const shrinkProgress = Math.min(1, shrinkDistance / maxShrinkDistance)
                    const newScale = 1.5 - shrinkProgress * 0.5 // Scale from 1.5 back to 1
                    setButtonScale(Math.max(1, newScale))
                } else if (animationComplete && currentScrollY < frozenScrollY.current - 100) {
                    // Reset everything when scrolling back up past the SendInSeconds component
                    setAnimationComplete(false)
                    setShrinkingPhase(false)
                    setButtonScale(1)
                    setHasGrown(false)
                }

                // Update previous scroll position for direction tracking
                previousScrollY.current = currentScrollY
            }
        }

        const handleWheel = (event: WheelEvent) => {
            if (isScrollFrozen && !animationComplete) {
                event.preventDefault()

                // Only increase scale when scrolling down (positive deltaY)
                if (event.deltaY > 0) {
                    virtualScrollY.current += event.deltaY

                    // Scale button based on virtual scroll (max scale of 1.5) - requires more scrolling
                    const maxVirtualScroll = 500 // Increased from 200 to require more scrolling
                    const newScale = Math.min(1.5, 1 + (virtualScrollY.current / maxVirtualScroll) * 0.5)
                    setButtonScale(newScale)

                    // Complete animation when we reach max scale
                    if (newScale >= 1.5) {
                        setAnimationComplete(true)
                        setHasGrown(true)
                        document.body.style.overflow = ''
                        setIsScrollFrozen(false)
                    }
                }
                // When scrolling up (negative deltaY), don't change the scale
            }
        }

        window.addEventListener('scroll', handleScroll)
        window.addEventListener('wheel', handleWheel, { passive: false })
        handleScroll() // Check initial state

        return () => {
            window.removeEventListener('scroll', handleScroll)
            window.removeEventListener('wheel', handleWheel)
            document.body.style.overflow = '' // Cleanup
        }
    }, [isScrollFrozen, animationComplete, shrinkingPhase, hasGrown])

    const marqueeProps = {
        message: hero.marquee.message,
        imageSrc: HandThumbsUp.src,
        backgroundColor: 'bg-secondary-1',
    }

    return (
        <Layout className="!m-0 w-full !p-0">
            <Hero
                heading={hero.heading}
                primaryCta={hero.primaryCta}
                buttonVisible={buttonVisible}
                buttonScale={buttonScale}
            />
            <div className="relative z-1">
                <MarqueeComp {...marqueeProps} />
            </div>
            <YourMoney />
            <div className="relative z-1">
                <MarqueeComp {...marqueeProps} />
            </div>
            <NoFees />
            <div className="relative z-1">
                <MarqueeComp {...marqueeProps} />
            </div>
            <SecurityBuiltIn />
            <div className="relative z-1">
                <MarqueeComp {...marqueeProps} />
            </div>
            <FAQs heading={faqs.heading} questions={faqs.questions} marquee={faqs.marquee} />
            <div className="relative z-1">
                <MarqueeComp {...marqueeProps} />
            </div>
            <div ref={sendInSecondsRef}>
                <SendInSeconds />
            </div>
            <div className="relative z-1">
                <MarqueeComp {...marqueeProps} />
            </div>
            <BusinessIntegrate />
            <div className="relative z-1">
                <MarqueeComp {...marqueeProps} />
            </div>
        </Layout>
    )
}
