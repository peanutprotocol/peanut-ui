import { Metadata } from 'next'
import * as assets from '@/assets'
import Layout from '@/components/Global/Layout'
import { Hero, FAQs, Features, Mike, Story, Intro } from '@/components/Club'

export const metadata: Metadata = {
    title: 'Peanut Protocol',
    description: 'Text Tokens',
    metadataBase: new URL('https://peanut.to'),
    icons: {
        icon: '/logo-favicon.png',
    },
    openGraph: {
        images: [
            {
                url: '/metadata-img.png',
            },
        ],
    },
}
export default function PeanutClub() {
    const hero = {
        heading: 'Peanut club',
        marquee: {
            visible: true,
            message: 'Peanut Frens',
        },
    }
    const story = {
        stories: [
            {
                copy: 'Mike wanted to pay his fren for dinner, but didn’t have their wallet address handy. He spent ages searching through messages, trying to find it. Finally, he found something that looked right, but in his rush, he fat thumbed the address. The tokens went to a complete stranger. Now, Mike’s out of money, and Tom’s still waiting to get paid. Talk about a headache!',
            },
            {
                copy: 'On the other side of discord. Sarah needed to pay her fren back for concert tickets, but didn’t have his wallet address. No worries! She quickly created a Peanut link, loaded it with ETH on mainnet, and sent it over to Jake. Jake got the link, and withdrew it as usdc on base directly to his wallet. No stress, no mistakes— Boom—done!',
            },
        ],

        foot: 'Dont be Mike. send a PEANUT link.',
        marquee: {
            visible: true,
            message: 'Peanut Frens',
        },
    }

    const features = {
        sections: [
            {
                heading: 'Send tokens, like a pro.',
                testimonials: [
                    {
                        imageSrc: assets.DEREK_PERSON.src,
                        altText: 'picture of chad',
                        comment: 'How did this not exist before?! Great UX!',
                        name: 'Derek Rein',
                        detail: 'WalletConnect',
                        detailRedirectUrl: 'https://walletconnect.com/',
                        bgColorClass: 'bg-white',
                    },
                    {
                        imageSrc: assets.SHARUK_PERSON.src,
                        altText: 'eco man',
                        comment: 'Peanut allows us to elegantly solve the cold start problem!',
                        name: 'shahrukh Rao',
                        detail: 'Eco',
                        detailRedirectUrl: 'https://eco.org/?ref=com',
                        bgColorClass: 'bg-white',
                    },
                    {
                        imageSrc: assets.KOFIME_PERSON.src,
                        altText: 'kofi',
                        comment: 'Very buttery experience!',
                        name: 'Kofi.me',
                        detail: 'Kofi.me',
                        detailRedirectUrl: 'https://www.kofime.xyz/',
                        bgColorClass: 'bg-white',
                    },
                    {
                        imageSrc: assets.SBF_PERSON.src, // TODO: replace with actual image@
                        altText: 'picture of pixel art SBF',
                        comment: 'I have a peanut allergy. Help!',
                        name: 'CEx CEO',
                        detail: 'Probably FTX',
                        bgColorClass: 'bg-white',
                    },
                ],
            },
            {
                heading: 'Send tokens, without the Complexity.',
                list: [
                    'Multiple tokens, one link',
                    'Withdraw funds',
                    'No more fat thumbing',
                    'No more searching for addresses',
                ],
            },
        ],
        marquee: {
            visible: true,
            message: 'Peanut Frens',
        },
    }

    const faqs = {
        heading: 'FAQs',
        questions: [
            {
                question: 'How can I try?',
                answer: 'Check out our dapp or any of the projects that already integrated Peanut.',
            },
            {
                question: 'What are the trust assumptions?',
                answer: 'Peanut Protocol is non-custodial, permissionless and decentralised. Read more ',
                redirectUrl: 'https://docs.peanut.to/overview/what-are-links/trust-assumptions',
                redirectText: 'here.',
            },
            {
                question: 'What happens if I want to cancel or if I lose the link?',
                answer: 'The only thing you need is the transaction hash! To see how, click ',
                redirectUrl: 'https://peanut.to/refund',
                redirectText: 'here.',
            },
            {
                question: 'What are the fees?',
                answer: 'On our dapp, we sponsor gasless claiming and sending on L2s. Integrators can choose to sponsor the transactions. We do not have a fee on the protocol for same-chain transactions, see ',
                redirectUrl: 'https://docs.peanut.to/overview/pricing',
                redirectText: 'here.',
            },
            {
                question: 'I need help!',
                answer: 'Sure! Let us know at hello@peanut.to or on ',
                redirectUrl: 'https://discord.gg/uWFQdJHZ6j',
                redirectText: 'discord.',
            },
            {
                question: 'Are you audited?',
                answer: 'Yes! ',
                redirectUrl: 'https://docs.peanut.to/other/security-audit',
                redirectText: 'See our docs for more',
            },
            {
                question: 'I want this for our app! How long does it take to integrate?',
                answer: 'Our record integration took 2 hours, but it depends on your stack. ',
                calModal: true,
                redirectText: 'Lets talk!',
            },
        ],
        marquee: {
            visible: true,
            message: 'Peanut Frens',
        },
    }

    const mike = {
        lines: ['Peanut', "Don't be Mike", ' Send a PEANUT link'],
    }

    return (
        <Layout className="!mx-0 w-full !px-0 !pt-0 ">
            <Hero heading={hero.heading} marquee={hero.marquee} />
            <Intro />
            <Story stories={story.stories} foot={story.foot} marquee={story.marquee} />
            <Features sections={features.sections} marquee={features.marquee} />
            <FAQs heading={faqs.heading} questions={faqs.questions} marquee={faqs.marquee} />
            <Mike lines={mike.lines} />
        </Layout>
    )
}
