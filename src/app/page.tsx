'use client'

import Layout from '@/components/Global/Layout'
import {
    DropLink,
    FAQs,
    Hero,
    Marquee,
    NoFees,
    SecurityBuiltIn,
    SendInSeconds,
    YourMoney,
    RegulatedRails,
} from '@/components/LandingPage'
import Footer from '@/components/LandingPage/Footer'
import Manteca from '@/components/LandingPage/Manteca'
import TweetCarousel from '@/components/LandingPage/TweetCarousel'
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
            visible: true,
            message: ['No fees', 'Instant', '24/7', 'USD', 'EUR', 'CRYPTO', 'GLOBAL', 'SELF-CUSTODIAL'],
        },
        primaryCta: {
            label: 'SIGN UP',
            href: '/setup',
            subtext: 'takes 10 seconds',
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
                answer: 'Peanut is the easiest way to send digital dollars to anyone anywhere. Peanut’s tech is powered by cutting-edge cryptography and the security of biometric user authentication as well as a network of modern and fully licensed banking providers.',
            },
            {
                id: '2',
                question: 'Do I have to KYC?',
                answer: 'No! You can use core functionalities (like sending and receiving money) without KYC. Bank connections, however, trigger a one‑time check handled by Persona, a SOC2 Type 2 certified and GDPR compliant ISO 27001–certified provider used by brands like Square and Robinhood. Your documents remain locked away with Persona, not Peanut, and Peanut only gets a yes/no response, keeping your privacy intact.',
            },
            {
                id: '3',
                question: 'Could a thief drain my wallet if they stole my phone?',
                answer: 'Not without your face or fingerprint. The passkey is sealed in the Secure Enclave of your phone and never exported. It’s secured by NIST‑recommended P‑256 Elliptic Curve cryptography. Defeating that would be tougher than guessing all 10¹⁰¹⁰ combinations of a 30‑character password made of emoji.\nThis means that neither Peanut or even regulators could freeze, us or you to hand over your account, because we can’t hand over what we don’t have. Your key never touches our servers; compliance requests only see cryptographic and encrypted signatures. Cracking those signatures would demand more energy than the Sun outputs in a full century.',
            },
            {
                id: '4',
                question: 'What happens to my funds if Peanut’s servers were breached?',
                answer: "Nothing. Your funds sit in your self‑custodied smart account (not on Peanut servers). Every transfer still needs a signature from your biometric passkey, so a server‑side attacker has no way to move a cent without the private key sealed in your device's Secure Enclave. Even if Peanut were offline, you could point any ERC‑4337‑compatible wallet at your smart account and recover access independently.",
            },
            {
                id: '5',
                question: 'How does Peanut make money?',
                answer: 'We plan to charge merchants for accepting Peanut as a payment method, whilst still being much cheaper than VISA and Mastercard. For users, we only charge minimal amounts!',
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

    const marqueeProps = { visible: hero.marquee.visible, message: hero.marquee.message }

    return (
        <Layout className="enable-select !m-0 w-full !p-0">
            <Hero primaryCta={hero.primaryCta} buttonVisible={buttonVisible} buttonScale={buttonScale} />
            <Marquee {...marqueeProps} />
            <Manteca />
            <Marquee {...marqueeProps} />
            <TweetCarousel />
            <Marquee {...marqueeProps} />
            <RegulatedRails />
            <Marquee {...marqueeProps} />
            <YourMoney />
            <Marquee {...marqueeProps} />
            <DropLink />
            <Marquee {...marqueeProps} />
            <SecurityBuiltIn />
            <Marquee {...marqueeProps} />
            <div ref={sendInSecondsRef}>
                <SendInSeconds />
            </div>
            <Marquee {...marqueeProps} />
            <NoFees />
            <Marquee {...marqueeProps} />
            <FAQs heading={faqs.heading} questions={faqs.questions} marquee={faqs.marquee} />
            <Marquee {...marqueeProps} />
            <Footer />
        </Layout>
    )
}
