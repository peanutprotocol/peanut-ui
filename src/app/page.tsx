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
        const observer = new IntersectionObserver(
            ([entry]) => {
                setSendInSecondsInView(entry.isIntersecting)
            },
            { threshold: 0.3 } // Trigger when 30% of the section is visible
        )

        if (sendInSecondsRef.current) {
            observer.observe(sendInSecondsRef.current)
        }

        return () => observer.disconnect()
    }, [])

    return (
        <Layout className="!m-0 w-full !p-0">
            <Hero 
                heading={hero.heading} 
                primaryCta={hero.primaryCta} 
                buttonVisible={buttonVisible}
                sendInSecondsInView={sendInSecondsInView}
            />
            <Marquee visible={hero.marquee.visible} message={hero.marquee.message} />
            <YourMoney />
            <Marquee visible={hero.marquee.visible} message={hero.marquee.message} />
            <NoFees />
            <Marquee visible={hero.marquee.visible} message={hero.marquee.message} />
            <SecurityBuiltIn />
            <Marquee visible={hero.marquee.visible} message={hero.marquee.message} />
            <FAQs heading={faqs.heading} questions={faqs.questions} marquee={faqs.marquee} />
            <Marquee visible={hero.marquee.visible} message={hero.marquee.message} />
            <div ref={sendInSecondsRef}>
                <SendInSeconds />
            </div>
            <Marquee visible={hero.marquee.visible} message={hero.marquee.message} />
            <BusinessIntegrate />
            <Marquee visible={hero.marquee.visible} message={hero.marquee.message} />
        </Layout>
    )
}
