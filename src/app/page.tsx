'use client'

import { useState, useEffect } from 'react'
import { Metadata } from 'next'
import * as assets from '@/assets'
import Layout from '@/components/Global/Layout'
import { Hero, FAQs, Features, Mike, Story, Intro, BuildOnUs, CashoutSection } from '@/components/LandingPage'
import { MarqueeComp } from '@/components/Global/MarqueeWrapper'
import { useFooterVisibility } from '@/context/footerVisibility'

const metadata: Metadata = {
    title: 'Peanut Protocol',
    description: 'Text Tokens',
    metadataBase: new URL('https://peanut.to'),
    icons: {
        icon: '/favicon.ico',
    },
    openGraph: {
        images: [
            {
                url: '/metadata-img.png',
            },
        ],
    },
}

export default function LandingPage() {
    const hero = {
        heading: 'Peanut',
        marquee: {
            visible: true,
            message: 'Peanut',
        },
        cta: {
            label: 'TRY NOW',
            href: '/send',
        },
    }
    const story = {
        marquee: {
            visible: true,
            message: 'Peanut',
        },
    }

    const features = {
        sections: [
            {
                heading: 'Text money, the easy way.',
                list: [
                    'Multiple tokens, one link',
                    'Cashout to your bank instantly',
                    'No more searching for wallet addresses',
                    'No more mistakes',
                    'Safe & secure - only YOU have access to your tokens',
                ],
            },
            {
                heading: 'Send tokens, like a pro.',
                testimonials: [
                    {
                        imageSrc: assets.DEREK_PERSON.src,
                        altText: 'picture of chad',
                        comment: 'Amazing!',
                        name: 'Derek Rein',
                        detail: 'WalletConnect',
                        detailRedirectUrl: 'https://walletconnect.com/',
                        bgColorClass: 'bg-white',
                    },
                    {
                        imageSrc: assets.SHARUK_PERSON.src,
                        altText: 'eco man',
                        comment: 'Now I can save my dollars easily',
                        name: 'Gianluca',
                        detail: 'Eco',
                        detailRedirectUrl: 'https://eco.org/?ref=com',
                        bgColorClass: 'bg-white',
                    },
                    {
                        imageSrc: assets.SBF_PERSON.src, // TODO: replace with actual image@
                        altText: 'picture of pixel art SBF',
                        comment: 'I have a peanut allergy Help!',
                        name: 'Banker',
                        detail: 'Probably FTX',
                        bgColorClass: 'bg-white',
                    },
                ],
            },
        ],
        marquee: {
            visible: true,
            message: 'Peanut',
        },
    }

    const faqs = {
        heading: 'Faqs',
        questions: [
            {
                id: '0',
                question: 'How can I try?',
                answer: 'Check out our dapp or any of the projects that already integrated Peanut.',
            },
            {
                id: '1',
                question: 'What are the trust assumptions?',
                answer: 'Peanut Protocol is non-custodial, permissionless and decentralised. Read more ',
                redirectUrl: 'https://docs.peanut.to/overview/what-are-links/trust-assumptions',
                redirectText: 'here.',
            },
            {
                id: '2',
                question: 'What happens if I want to cancel or if I lose the link?',
                answer: 'The only thing you need is the transaction hash! To see how, click ',
                redirectUrl: 'https://peanut.to/refund',
                redirectText: 'here.',
            },
            {
                id: '3',
                question: 'What are the fees?',
                answer: 'On our dapp, we sponsor gasless claiming and sending on L2s. Integrators can choose to sponsor the transactions. We do not have a fee on the protocol for same-chain transactions, see ',
                redirectUrl: 'https://docs.peanut.to/overview/pricing',
                redirectText: 'here.',
            },
            {
                id: '4',
                question: 'I need help!',
                answer: 'Sure! Let us know at hello@peanut.to or on ',
                redirectUrl: 'https://discord.gg/uWFQdJHZ6j',
                redirectText: 'discord.',
            },
            {
                id: '5',
                question: 'Are you audited?',
                answer: 'Yes! ',
                redirectUrl: 'https://docs.peanut.to/other/security-audit',
                redirectText: 'See our docs for more',
            },
            {
                id: '6',
                question: 'I want this for our app! How long does it take to integrate?',
                answer: 'Our record integration took 2 hours, but it depends on your stack. ',
                calModal: true,
                redirectText: 'Lets talk!',
            },
        ],
        marquee: {
            visible: true,
            message: 'Peanut',
        },
    }

    const mike = {
        lines: ['Peanut', 'Text money'],
    }

    const { isFooterVisible } = useFooterVisibility()
    const [buttonVisible, setButtonVisible] = useState(true)

    useEffect(() => {
        if (isFooterVisible) {
            setButtonVisible(false)
        } else {
            setButtonVisible(true)
        }
    }, [isFooterVisible])

    return (
        <Layout className="!m-0 w-full !p-0">
            <Hero heading={hero.heading} marquee={hero.marquee} cta={hero.cta} buttonVisible={buttonVisible} />
            <FAQs heading={faqs.heading} questions={faqs.questions} marquee={faqs.marquee} />
            <BuildOnUs />
            {/* <MarqueeComp
                message="PEANUT PROTOCOL • BUILD WITH US • PEANUT PROTOCOL • BUILD WITH US"
                imageSrc={assets.SmileStars.src}
                backgroundColor="bg-n-1"
            />
            <div className="bg-blue-1">
                <CashoutSection />
            </div> */}

            {/* <Features sections={[features.sections[0]]} marquee={features.marquee} />
            <Intro />

            <Story marquee={story.marquee} />
            <Features sections={[features.sections[1]]} marquee={features.marquee} />
            <Mike lines={mike.lines} /> */}
        </Layout>
    )
}
