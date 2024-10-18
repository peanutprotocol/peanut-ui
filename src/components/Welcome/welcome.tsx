'use client'
import '@/styles/globals.css'
import { useEffect, useState } from 'react'
import Link from 'next/link'

import * as assets from '@/assets'
import * as chain_logos from '@/assets/chains'
import { MarqueeWrapper } from '../Global/MarqueeWrapper'

const logoCloudLogos = [
    { icon: assets.WALLETCONNECT_LOGO, link: 'https://walletconnect.com/' },
    { icon: assets.CLAVE_LOGO, link: 'https://www.getclave.io/', classNameImg: 'rounded-full' },
    { icon: assets.ECO_LOGO, link: 'https://eco.org/?ref=com' },
    { icon: assets.MANTLE_ICON, link: 'https://www.mantle.xyz/' },
    {
        icon: assets.BLOCKSCOUT_LOGO,
        link: 'https://www.blockscout.com/',
        className: 'bg-black',
        classNameImg: 'rounded-full',
    },
    {
        icon: assets.HYPERSPHERE_LOGO_SQUARE,
        link: 'https://www.hypersphere.ventures/',
        classNameImg: 'rounded-full',
    },
    {
        icon: assets.ZEEPRIME_LOGO_SQUARE,
        link: 'https://zeeprime.capital/',
        className: ' bg-white rounded-full ',
        classNameImg: 'h-6 w-6 sm:h-12 sm:w-12 -mt-[4px]',
    },
    {
        icon: assets.LONGHASH_LOGO_SQUARE,
        link: 'https://www.longhash.vc/',
        className: 'p-0 bg-white',
        classNameImg: 'h-6 w-6 sm:h-12 sm:w-12 rounded-lg',
    },
    {
        icon: assets.NAZARE_LOGO_SQUARE,
        link: 'https://www.nazare.io/',
        classNameImg: 'rounded-full',
    },
]

const faqs = [
    { question: 'How can I try?', answer: 'Check out our dapp or any of the projects that already integrated Peanut.' },
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
]
const testimonials = [
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
        imageSrc: assets.SBF_PERSON.src,
        altText: 'picture of pixel art SBF',
        comment: 'I have a peanut allergy. Help!',
        name: 'CEx CEO',
        detail: 'Probably FTX',
        bgColorClass: 'bg-white',
    },
]

export function Welcome() {
    const [openedFaq, setOpenedFaq] = useState<number | null>(null)

    function classNames(...classes: any) {
        return classes.filter(Boolean).join(' ')
    }

    useEffect(() => {
        // Ensure this code only runs on the client
        if (typeof window !== 'undefined' && window.parent) {
            const currentOrigin = window.location.origin
            // Send a message to the parent window to close the modal
            window.parent.postMessage('close-modal', currentOrigin)
        }
    }, [])

    return (
        <div className="flex w-full flex-col items-center justify-center">
            <div className="flex w-full border-b-2 border-black text-black dark:text-white">
                <div className="flex w-full flex-col items-center justify-center gap-8 py-8 text-center sm:px-6 sm:py-16 lg:mx-0 lg:w-2/3 lg:px-0">
                    <div className="flex w-full flex-col items-center justify-center gap-2">
                        <div className="mx-auto flex w-3/4 flex-row items-center justify-center gap-2 text-h1">
                            Send{' '}
                            <div className=" scroller w-[175px]">
                                <span className="">
                                    NFTs
                                    <br />
                                    USDC
                                    <br />
                                    DAI
                                    <br />
                                    PEPE
                                </span>
                            </div>
                        </div>
                        <label className="mx-auto w-3/4 text-h1">Via Link</label>
                    </div>
                    <div className="mx-auto w-3/4 text-h5 font-normal">
                        Send money to your friends without having to worry about anything else!
                    </div>

                    <div className="flex w-full items-center justify-center space-x-4 p-2 sm:gap-4">
                        <Link
                            href={'/send'}
                            className="btn-purple btn-xl cursor-pointer bg-white px-4 text-h4 md:w-3/5 lg:w-1/3"
                        >
                            App
                        </Link>

                        <Link
                            href="https://docs.peanut.to"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-h4 "
                        >
                            Integrate →
                        </Link>
                    </div>

                    <div className="mx-5 flex flex-row flex-wrap items-center justify-center gap-4 gap-y-8 sm:gap-8">
                        {logoCloudLogos.map((logo) => {
                            return (
                                <a
                                    href={logo.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    key={logo.icon.src}
                                    className={`spin-on-hover group flex h-8 w-8 items-center justify-center rounded-full border border-n-1 dark:border-white sm:h-16 sm:w-16 ${logo.className}`}
                                >
                                    <img
                                        className={` h-full object-contain ${logo.classNameImg}`}
                                        src={logo.icon.src}
                                        alt="Logo"
                                        loading="eager"
                                    />
                                </a>
                            )
                        })}
                    </div>
                </div>

                <div className="center-xy z-index-1 relative hidden w-1/3 items-center justify-center overflow-hidden border-l-2 border-black py-3 lg:flex lg:pb-16 lg:pt-16 ">
                    <img
                        src={assets.PEANUTMAN_HAPPY.src}
                        className="absolute z-50 duration-200 hover:rotate-12 "
                        alt="Peanutman Cheering"
                    />
                </div>
            </div>

            <div className="grid w-full grid-cols-1  gap-4 bg-transparent px-4 py-6 text-black lg:grid-cols-3">
                <label className="flex items-center justify-center border border-n-2 bg-white px-4 py-8 text-center text-h3 font-black sm:px-16">
                    300k+ Transactions
                </label>

                <label className="flex items-center justify-center border border-n-2 bg-white px-4 py-8 text-center text-h3 font-black sm:px-16">
                    105k+ Unique wallet addresses
                </label>

                <label className="flex items-center justify-center border border-n-2 bg-white px-4 py-8 text-center  text-h3 font-black sm:px-16">
                    20+ Chains
                </label>
            </div>

            <div className="border-t-[1px] border-black bg-white py-6">
                <MarqueeWrapper backgroundColor="bg-transparant" direction="right" className="">
                    {Object.entries(chain_logos).map(([chain, logo]) => {
                        return (
                            <div className="pl-3 " key={chain}>
                                <img loading="eager" src={logo.src} className="h-16 w-16" />
                            </div>
                        )
                    })}
                </MarqueeWrapper>
            </div>

            <div className="flex w-full flex-col items-center justify-center border-y-[1px] border-black ">
                <div className="w-full border-black px-4">
                    <div className="flex w-full flex-col gap-4 px-4 py-4 text-black">
                        <label className="my-0 px-8 text-h2 font-bold">FAQ</label>
                        <div className="flex cursor-pointer flex-col gap-0">
                            {faqs.map((faq, idx) => (
                                <div
                                    key={idx}
                                    className={classNames(
                                        'rounded-none border border-n-1 bg-white text-black ',
                                        faqs.length - 1 === idx ? ' brutalborder-bottom' : ''
                                    )}
                                    onClick={() => {
                                        if (openedFaq === idx) {
                                            setOpenedFaq(null)
                                        } else {
                                            setOpenedFaq(idx)
                                        }
                                    }}
                                >
                                    <div
                                        className={classNames(
                                            ' flex w-full  flex-row items-center justify-between border-none bg-white  text-2xl '
                                        )}
                                    >
                                        <label className=" px-8 py-4">{faq.question}</label>
                                        <img
                                            style={{
                                                transform: openedFaq === idx ? 'scaleY(-1)' : 'none',
                                                transition: 'transform 0.3s ease-in-out',
                                            }}
                                            src={assets.DROPDOWN_ICON.src}
                                            alt=""
                                            className={'h-6 pr-2'}
                                        />
                                    </div>
                                    {openedFaq === idx && (
                                        <div className={' m-0 px-8 py-2 '}>
                                            <p>
                                                {faq.answer}
                                                {faq.calModal && (
                                                    <a
                                                        data-cal-link="kkonrad+hugo0/15min?duration=30"
                                                        data-cal-config='{"layout":"month_view"}'
                                                        className=" underline"
                                                    >
                                                        Let's talk!
                                                    </a>
                                                )}
                                                {faq.redirectUrl && (
                                                    <a
                                                        href={faq.redirectUrl}
                                                        target="_blank"
                                                        className="text-black underline"
                                                    >
                                                        {faq.redirectText}
                                                    </a>
                                                )}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <MarqueeWrapper backgroundColor="bg-black" direction="left">
                    <>
                        <img loading="eager" src={assets.SMILEY_ICON.src} alt="logo" className=" mr-1 h-5 md:h-8" />
                        <div className="mr-2 py-2 text-center font-black uppercase italic tracking-wide text-white md:py-4 md:text-4xl">
                            FRENS
                        </div>
                    </>
                </MarqueeWrapper>
            </div>

            <div role="list" className="grid:cols-1 grid gap-4 px-4 py-6 text-black md:grid-cols-2 lg:grid-cols-4">
                {testimonials.map((testimonial, index) => (
                    <div
                        key={index}
                        className={`${testimonial.bgColorClass} flex w-full flex-col items-center justify-center gap-2 border border-n-1 p-2 text-center`}
                        id="frens"
                    >
                        <img
                            //@ts-ignore
                            src={testimonial.imageSrc}
                            alt={testimonial.altText}
                            className="rainbow-border mx-auto w-1/2 rounded-full bg-white p-1"
                        />
                        <label className="mx-auto mt-2 h-12 py-2 text-base text-h6 font-normal italic ">
                            {testimonial.comment}
                        </label>
                        <p className="mb-4 text-base font-black uppercase">
                            {testimonial.name}
                            <a
                                className="text-xs font-normal text-black"
                                href={testimonial?.detailRedirectUrl ?? undefined}
                                target="_blank"
                            >
                                <br /> {testimonial.detail}{' '}
                            </a>
                        </p>
                    </div>
                ))}
            </div>
        </div>
    )
}
