'use client'

import Layout from '@/components/Global/Layout'
import { FAQs, Hero } from '@/components/LandingPage'
import { useFooterVisibility } from '@/context/footerVisibility'
import { useEffect, useState } from 'react'

export default function LandingPage() {
    const { isFooterVisible } = useFooterVisibility()
    const [buttonVisible, setButtonVisible] = useState(true)

    const hero = {
        heading: 'Peanut',
        marquee: {
            visible: true,
            message: ['No fees', 'Instant', '24/7', 'Dollars', 'Fiat / Crypto'],
        },
        primaryCta: {
            label: 'TRY NOW',
            href: '/setup',
        },
        secondaryCta: {
            label: 'CASHOUT',
            href: 'https://peanut.to/cashout',
            isExternal: true,
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
            {
                id: '2',
                question: `I'm waitlisted, now what?`,
                answer: `Congrats! Now you wait while we make it worth it. (Keep your notifs on to get alerted about the launch and  - it's going to be worth it. Pinky promise.)`,
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

    return (
        <Layout className="!m-0 w-full !p-0">
            <Hero
                heading={hero.heading}
                marquee={hero.marquee}
                primaryCta={hero.primaryCta}
                secondaryCta={hero.secondaryCta}
                buttonVisible={buttonVisible}
            />
            <FAQs heading={faqs.heading} questions={faqs.questions} marquee={faqs.marquee} />
        </Layout>
    )
}
