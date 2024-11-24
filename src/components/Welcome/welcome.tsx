'use client'

import '@/styles/globals.css'
import { useEffect } from 'react'
import Link from 'next/link'
import { Box } from '@chakra-ui/react'
import { motion } from 'framer-motion'

import {
    WALLETCONNECT_LOGO,
    CLAVE_LOGO,
    ECO_LOGO,
    MANTLE_ICON,
    BLOCKSCOUT_LOGO,
    HYPERSPHERE_LOGO_SQUARE,
    ZEEPRIME_LOGO_SQUARE,
    LONGHASH_LOGO_SQUARE,
    NAZARE_LOGO_SQUARE,
    DEREK_PERSON,
    SHARUK_PERSON,
    KOFIME_PERSON,
    SBF_PERSON,
    SmileStars,
    HandThumbs,
    Star,
    Eyes,
    GoodIdeaSign,
    SmileSide,
    PeanutGuy,
    HandThumbsUp,
} from '@/assets'
import * as chain_logos from '@/assets/chains'
import { MarqueeWrapper, MarqueeComp } from '../Global/MarqueeWrapper'
import { FAQsPanel } from '../Global/FAQs'
import { Testimonials } from '../Global/Testimonials'

const logoCloudLogos = [
    { id: '1', icon: WALLETCONNECT_LOGO, link: 'https://walletconnect.com/' },
    { id: '2', icon: CLAVE_LOGO, link: 'https://www.getclave.io/', classNameImg: 'rounded-full' },
    { id: '3', icon: ECO_LOGO, link: 'https://eco.org/?ref=com' },
    { id: '4', icon: MANTLE_ICON, link: 'https://www.mantle.xyz/' },
    {
        id: '5',
        icon: BLOCKSCOUT_LOGO,
        link: 'https://www.blockscout.com/',
        className: 'bg-black',
        classNameImg: 'rounded-full',
    },
    {
        id: '6',
        icon: HYPERSPHERE_LOGO_SQUARE,
        link: 'https://www.hypersphere.ventures/',
        classNameImg: 'rounded-full',
    },
    {
        id: '7',
        icon: ZEEPRIME_LOGO_SQUARE,
        link: 'https://zeeprime.capital/',
        className: 'bg-white rounded-full',
        classNameImg: 'h-6 w-6 sm:h-12 sm:w-12 -mt-[4px]',
    },
    {
        id: '8',
        icon: LONGHASH_LOGO_SQUARE,
        link: 'https://www.longhash.vc/',
        className: 'p-0 bg-white',
        classNameImg: 'h-6 w-6 sm:h-12 sm:w-12 rounded-lg',
    },
    {
        id: '9',
        icon: NAZARE_LOGO_SQUARE,
        link: 'https://www.nazare.io/',
        classNameImg: 'rounded-full',
    },
]

const faqs = [
    {
        id: '0',
        question: 'How can I try?',
        answer: 'Check out our dapp or any of the projects that already integrated Peanut.',
    },
    {
        id: '1',
        question: 'What are the trust assumptions?',
        answer: 'Peanut Protocol is non-custodial, permissionless and decentralised. Read more ',
        redirectUrl: 'https://docs.peanut.to/how-to-use-peanut-links/trust-assumptions',
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
        redirectUrl: 'https://docs.peanut.to/pricing',
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
        redirectUrl: 'https://docs.peanut.to/security-audit',
        redirectText: 'See our docs for more',
    },
    {
        id: '6',
        question: 'I want this for our app! How long does it take to integrate?',
        answer: 'Our record integration took 2 hours, but it depends on your stack. ',
        calModal: true,
        redirectText: 'Let’s talk!',
    },
]

const testimonials = [
    {
        imageSrc: DEREK_PERSON.src,
        altText: 'Picture of Derek Rein',
        comment: 'How did this not exist before?! Great UX!',
        name: 'Derek Rein',
        detail: 'WalletConnect',
        detailRedirectUrl: 'https://walletconnect.com/',
        bgColorClass: 'bg-white',
    },
    {
        imageSrc: SHARUK_PERSON.src,
        altText: 'Eco Man',
        comment: 'Peanut allows us to elegantly solve the cold start problem!',
        name: 'Shahrukh Rao',
        detail: 'Eco',
        detailRedirectUrl: 'https://eco.org/?ref=com',
        bgColorClass: 'bg-white',
    },
    {
        imageSrc: KOFIME_PERSON.src,
        altText: 'Kofi',
        comment: 'Very buttery experience!',
        name: 'Kofi.me',
        detail: 'Kofi.me',
        detailRedirectUrl: 'https://www.kofime.xyz/',
        bgColorClass: 'bg-white',
    },
    {
        imageSrc: SBF_PERSON.src, // TODO: replace with actual image
        altText: 'Picture of pixel art SBF',
        comment: 'I have a peanut allergy. Help!',
        name: 'CEx CEO',
        detail: 'Probably FTX',
        detailRedirectUrl: '',
        bgColorClass: 'bg-white',
    },
]

function Welcome() {
    useEffect(() => {
        // Ensure this code only runs on the client
        if (typeof window !== 'undefined' && window.parent) {
            const currentOrigin = window.location.origin
            // Send a message to the parent window to close the modal
            window.parent.postMessage('close-modal', currentOrigin)
        }
    }, [])

    return (
        <div className="flex w-full flex-col items-center justify-center overflow-x-hidden">
            <div className="relative">
                {/* <motion.img
                    initial={{ opacity: 0, translateY: 28, translateX: -5 }}
                    whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                    transition={{ type: 'spring', damping: 5 }}
                    src={PeanutGuy.src}
                    alt="Peanut Guy"
                    className="absolute bottom-[3%] right-[-2%] z-0 hidden h-1/3 md:bottom-[6%] md:right-[-12%] md:h-1/2 lg:right-0 lg:block"
                /> */}

                <div className="space-y-12 py-12 sm:py-16 md:space-y-24 md:py-20 lg:space-y-28 lg:py-24">
                    <div className="relative flex w-full text-black dark:text-white">
                        <motion.img
                            initial={{ opacity: 0, translateY: 20, translateX: 5 }}
                            whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                            transition={{ type: 'spring', damping: 5 }}
                            src={Star.src}
                            alt="Star Icon"
                            className="absolute left-[2%] top-[15%] hidden w-12 md:left-[2%] md:top-[15%] md:block lg:left-[-3%] lg:top-[10%]"
                        />
                        <motion.img
                            initial={{ opacity: 0, translateY: 28, translateX: -5 }}
                            whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                            transition={{ type: 'spring', damping: 5 }}
                            src={Star.src}
                            alt="Star Icon"
                            className="absolute right-[3%] top-[18%] hidden w-12 md:-top-10 md:right-[3%] md:block lg:right-[-3%]"
                        />

                        {/* <motion.img
                            initial={{
                                rotate: 5,
                                opacity: 0,
                                translateY: 28,
                                translateX: -5,
                            }}
                            whileInView={{
                                rotate: -6,
                                opacity: 1,
                                translateY: 0,
                                translateX: 0,
                            }}
                            transition={{ type: 'spring', damping: 10 }}
                            src={Eyes.src}
                            alt="Eyes Emoji"
                            className="absolute left-[7%] top-[58%] hidden w-36 md:left-[1%] md:top-[65%] lg:left-[7%] lg:top-[58%] lg:block xl:left-[11%]"
                        /> */}

                        <div className="flex w-full flex-col items-center justify-center gap-8 text-center sm:px-6 md:gap-12 lg:mx-0 lg:px-0">
                            <div className="space-y-8">
                                <div className="flex w-full flex-col items-center justify-center gap-2">
                                    <div className="mx-auto flex flex-row flex-wrap items-center justify-center gap-2 text-h1 uppercase md:text-[4rem] lg:text-[5rem]">
                                        Send{' '}
                                        <div className="scroller w-[8.5rem] text-h1 md:w-[11rem] md:text-[4rem] lg:w-[14.75rem] lg:text-[5rem]">
                                            <span>
                                                NFTs
                                                <br />
                                                USDC
                                                <br />
                                                DAI
                                                <br />
                                                PEPE
                                            </span>
                                        </div>{' '}
                                        Via Link
                                    </div>
                                </div>

                                <div className="mx-auto w-3/4 max-w-4xl text-h4 uppercase">
                                    Send money to your friends without having to worry about anything else!
                                </div>
                            </div>

                            <div className="flex w-full items-center justify-center space-x-4 p-2 px-4 sm:gap-4">
                                <Link href={'/send'} className="btn-purple btn-2xl max-w-64">
                                    App
                                </Link>

                                <Link
                                    href="https://docs.peanut.to"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="whitespace-nowrap px-3 text-xl font-bold md:text-2xl"
                                >
                                    Integrate →
                                </Link>
                            </div>
                        </div>
                    </div>

                    <div className="flex w-full flex-wrap items-center gap-4 bg-transparent px-4">
                        <label className="feature feature-primary grow origin-center md:-rotate-2">
                            300k+ Transactions
                        </label>
                        <label className="feature grow md:rotate-1">20+ Chains</label>
                        <label className="feature feature-primary grow md:-rotate-1">
                            105k+ Unique wallet addresses
                        </label>
                    </div>

                    <div className="relative mx-5 flex flex-row flex-wrap items-center justify-center gap-4">
                        {logoCloudLogos.map((logo) => (
                            <a
                                href={logo.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                key={logo.id} // Use unique id
                                className={`spin-on-hover group flex h-8 w-8 items-center justify-center rounded-full border border-n-1 dark:border-white sm:h-16 sm:w-16 ${logo.classNameImg || logo.className || ''}`}
                            >
                                <img
                                    className={`h-full object-contain ${logo.classNameImg || ''}`}
                                    src={logo.icon.src}
                                    alt="Logo"
                                    loading="eager"
                                />
                            </a>
                        ))}
                    </div>
                </div>

                <MarqueeComp message="Frens send links" imageSrc={HandThumbsUp.src} />
            </div>

            <div className="flex w-full flex-col items-center justify-center">
                <FAQsPanel heading="FAQs" questions={faqs} />
            </div>

            <div
                role="list"
                className="relative z-10 mx-auto pb-20 pt-8 md:pb-24 md:pt-20 lg:px-4 xl:w-[92%] 2xl:w-4/5"
            >
                <Testimonials testimonials={testimonials} />
            </div>

            <div className="pb-14 md:pb-20">
                <MarqueeWrapper backgroundColor="bg-transparent" direction="right" className="">
                    {Object.entries(chain_logos).map(([chain, logo]) => {
                        return (
                            <div className="pl-3" key={chain}>
                                <img loading="eager" src={logo.src} className="h-16 w-16" alt={`${chain} Logo`} />
                            </div>
                        )
                    })}
                </MarqueeWrapper>
            </div>
        </div>
    )
}
