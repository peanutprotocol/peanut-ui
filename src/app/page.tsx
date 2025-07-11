'use client'

import Layout from '@/components/Global/Layout'
import {
    BusinessIntegrate,
    FAQs,
    Hero,
    Marquee,
    NoFees,
    SecurityBuiltIn,
    SendInSeconds,
    YourMoney,
} from '@/components/LandingPage'
import { useFooterVisibility } from '@/context/footerVisibility'
import { useEffect, useState, useRef } from 'react'

export default function LandingPage() {
    const { isFooterVisible } = useFooterVisibility()
    const [buttonVisible, setButtonVisible] = useState(true)
    const [sendInSecondsInView, setSendInSecondsInView] = useState(false)
    const sendInSecondsRef = useRef<HTMLDivElement>(null)

    const hero = {
        heading: 'Peanut',
        marquee: {
            visible: true,
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
                const rect = sendInSecondsRef.current.getBoundingClientRect()
                // Button fades when section enters viewport and reappears when section is mostly out of view
                const isInView = rect.top < window.innerHeight * 0.7 && rect.bottom > window.innerHeight * 0.8
                // console.log(`SendInSeconds - top: ${rect.top}, bottom: ${rect.bottom}, isInView: ${isInView}`)
                setSendInSecondsInView(isInView)
            }
        }

        window.addEventListener('scroll', handleScroll)
        handleScroll() // Check initial state

        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    const marqueeProps = { visible: hero.marquee.visible, message: hero.marquee.message }

    return (
        <Layout className="!m-0 w-full !p-0">
            <Hero
                heading={hero.heading}
                primaryCta={hero.primaryCta}
                buttonVisible={buttonVisible}
                sendInSecondsInView={sendInSecondsInView}
            />
            <Marquee {...marqueeProps} />
            <YourMoney />
            <Marquee {...marqueeProps} />
            <NoFees />
            <Marquee {...marqueeProps} />
            <SecurityBuiltIn />
            <Marquee {...marqueeProps} />
            <FAQs heading={faqs.heading} questions={faqs.questions} marquee={faqs.marquee} />
            <Marquee {...marqueeProps} />
            <div ref={sendInSecondsRef}>
                <SendInSeconds />
            </div>
            <Marquee {...marqueeProps} />
            <BusinessIntegrate />
            <Marquee {...marqueeProps} />
        </Layout>
    )
}
