'use client'

import * as assets from '@/assets'
import Layout from '@/components/Global/Layout'
import { BuildOnUs, FAQs, Features, Hero, Mike, Story } from '@/components/LandingPage'
import { useFooterVisibility } from '@/context/footerVisibility'
import { useEffect, useState } from 'react'

export default function LandingPage() {
    const hero = {
        heading: 'Peanut',
        marquee: {
            visible: true,
            message: 'Peanut',
        },
        cta: {
            label: 'TRY NOW',
            href: '/pay',
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
                heading: 'What they say',
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
                        comment: 'The easiest way to pay people!',
                        name: 'Gianluca',
                        detail: 'Eco',
                        detailRedirectUrl: 'https://eco.org/?ref=com',
                        bgColorClass: 'bg-white',
                    },
                    {
                        imageSrc: assets.SBF_PERSON.src,
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
                question: `So what's Peanut?`,
                answer: `With Peanut you can pay and get paid in digital dollars and other cryptocurrencies easily. You can also cash out 2000+ tokens from 20+ EVM chain directly to your bank account.`,
            },
            {
                id: '1',
                question: 'How can I try?',
                answer: 'Check out our dapp or any of the projects that already integrated Peanut.',
            },
            {
                id: '2',
                question: 'What are the trust assumptions?',
                answer: 'Peanut Protocol is non-custodial, permissionless and decentralised. Read more ',
                redirectUrl: 'https://docs.peanut.to/how-to-use-peanut-links/trust-assumptions',
                redirectText: 'here.',
            },
            {
                id: '3',
                question: 'What happens if I want to cancel or if I lose the link?',
                answer: 'The only thing you need is the transaction hash! To see how, click ',
                redirectUrl: 'https://peanut.to/refund',
                redirectText: 'here.',
            },
            {
                id: '4',
                question: 'What are the fees?',
                answer: 'On our dapp, we sponsor gasless claiming and sending on L2s. Integrators can choose to sponsor the transactions. We do not have a fee on the protocol for same-chain transactions, see ',
                redirectUrl: 'https://docs.peanut.to/pricing',
                redirectText: 'here.',
            },
            {
                id: '5',
                question: 'I need help!',
                answer: 'Sure! Let us know at hello@peanut.to or on ',
                redirectUrl: 'https://discord.gg/uWFQdJHZ6j',
                redirectText: 'discord.',
            },
            {
                id: '6',
                question: 'Are you audited?',
                answer: 'Yes! ',
                redirectUrl: 'https://docs.peanut.to/security-audit',
                redirectText: 'See our docs for more',
            },
            {
                id: '7',
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
        lines: ['PEANUT', 'buttery smooth'],
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
            <Story marquee={story.marquee} />
            <Features sections={[features.sections[1]]} marquee={features.marquee} />
            <div className="bg-pink-1">
                <Mike lines={mike.lines} />
            </div>
        </Layout>
    )
}
