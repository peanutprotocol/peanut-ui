'use client'
import '@/styles/globals.css'
import { useEffect, useState } from 'react'
import { getCalApi } from '@calcom/embed-react'
import Lottie from 'react-lottie'
import Link from 'next/link'

import * as assets from '@/assets'
import * as chain_logos from '@/assets/chains'
import { MarqueeWrapper } from '../Global/MarqueeWrapper'
import { Disclosure } from '@headlessui/react'

const logoCloudLogos = [
    { icon: assets.WALLETCONNECT_LOGO, link: 'https://walletconnect.com/' },
    { icon: assets.CLAVE_LOGO, link: 'https://www.getclave.io/' },
    { icon: assets.BRUME_LOGO, link: 'https://bento.me/brume' },
    { icon: assets.ECO_LOGO, link: 'https://eco.org/?ref=com' },
    { icon: assets.MANTLE_ICON, link: 'https://www.mantle.xyz/' },
    { icon: assets.WOOFI_LOGO, link: 'https://woo.org/' },
    { icon: assets.TIMESWAP_LOGO, link: 'https://timeswap.io/' },
    { icon: assets.CLEO_LOGO, link: 'https://cleo.exchange/swap' },
    { icon: assets.KTX_LOGO, link: 'https://ktx.finance/' },
    { icon: assets.LENDLE_LOGO, link: 'https://lendle.xyz/' },
    { icon: assets.IZUMI_LOGO, link: 'https://izumi.finance/' },
    { icon: assets.LOGX_LOGO, link: 'https://www.logx.trade/' },
    { icon: assets.BYBIT_LOGO, link: 'https://www.bybit.com/' },
]

const features = [
    {
        name: 'Brand ',
        description:
            'Your brand deserves to be front and center for new users. It’s nuts but you can completely whitelabel these links and use your own domain and branding.',
        bg: 'bg-yellow-1',
        primaryRedirectUrl: 'https://docs.peanut.to/integrate/sdk/branded-links',
        primaryRedirectText: 'Docs',
    },
    {
        name: 'Gasless',
        description:
            'Users should not have to worry about gas, being on the right chain or wallet addresses. Claim and send links solve the cold start problem.',
        bg: 'bg-pink-1',
        primaryRedirectUrl: 'https://docs.peanut.to/integrate/sdk/claim/claim-link-gasless',
        primaryRedirectText: 'Docs',
    },
    {
        name: 'Welcome packs',
        description: 'Send a welcome pack of NFT + gas + token to new or existing customers',
        bg: 'bg-red',
        calModal: true,
        primaryRedirectUrl: 'https://docs.peanut.to/overview/case-studies/sending-testnet-tokens-at-hackathons',
        primaryRedirectText: 'Case study',
    },
    {
        name: 'Cross-chain',
        description:
            'Customize token and claim page to match your branding with logo and colors. Or even better, have the users claim the tokens on your own domain or app!',
        bg: 'bg-green-1',
        primaryRedirectUrl: 'https://experimental.peanut.to/send',
        primaryRedirectText: 'Try Now',
        secondaryRedirectUrl: 'https://docs.peanut.to/integrate/sdk/claim/claim-link-cross-chain',
        secondaryRedirectText: 'Learn more',
    },
    {
        name: 'Get Physical',
        description: 'Are you planning an IRL event? Do a physical airdrop by distributing QR codes with tokens.',
        bg: 'bg-purple-2',
        calModal: true,
        primaryRedirectUrl: 'https://docs.peanut.to/overview/case-studies/irl-events-marketing',
        primaryRedirectText: 'Case study',
    },
    {
        name: 'Web2 Airdrops',
        description: 'Airdrop your web2 audience (think Discord, Mailchimp, Twitter)',
        bg: 'bg-yellow-1',
        calModal: true,
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
        bgColorClass: 'bg-red',
    },
    {
        imageSrc: assets.SHARUK_PERSON.src,
        altText: 'eco man',
        comment: 'Peanut allows us to elegantly solve the cold start problem!',
        name: 'shahrukh Rao',
        detail: 'Eco',
        detailRedirectUrl: 'https://eco.org/?ref=com',
        bgColorClass: 'bg-green-1',
    },
    {
        imageSrc: assets.KOFIME_PERSON.src,
        altText: 'kofi',
        comment: 'Very buttery experience!',
        name: 'Kofi.me',
        detail: 'Kofi.me',
        detailRedirectUrl: 'https://www.kofime.xyz/',
        bgColorClass: 'bg-pink-1',
    },
    {
        imageSrc: assets.SBF_PERSON.src, // TODO: replace with actual image@
        altText: 'picture of pixel art SBF',
        comment: 'I have a peanut allergy. Help!',
        name: 'CEx CEO',
        detail: 'Probably FTX',
        bgColorClass: 'bg-yellow-1',
    },
]
const defaultLottieOptions = {
    loop: true,
    autoplay: true,
    animationData: assets.REDPACKET_LOTTIE,
    rendererSettings: {
        preserveAspectRatio: 'xMidYMid slice',
    },
}

export function Welcome() {
    const [openedFaq, setOpenedFaq] = useState<number | null>(null)

    useEffect(() => {
        ;(async function () {
            const cal = await getCalApi()
            cal('ui', {
                theme: 'dark',
                styles: { branding: { brandColor: '#ffffff' } },
                hideEventTypeDetails: false,
                layout: 'month_view',
            })
        })()
    }, [])

    function classNames(...classes: any) {
        return classes.filter(Boolean).join(' ')
    }

    return (
        <div className="flex w-full flex-col items-center justify-center gap-4 bg-white  dark:bg-black ">
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
                        Go viral with claim links. Let your users send tokens through links
                    </div>

                    <div className="flex w-full items-center justify-center space-x-4 p-2 sm:gap-4">
                        <a
                            data-cal-link="kkonrad+hugo0/15min?duration=30"
                            data-cal-config='{"layout":"month_view"}'
                            className="btn-purple btn-xl cursor-pointer px-4 text-h4 md:w-3/5 lg:w-1/3"
                        >
                            Let's talk!
                        </a>

                        <a
                            href="https://docs.peanut.to"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-h4 underline"
                        >
                            Integrate →
                        </a>
                    </div>

                    <div className="mx-5 flex flex-row flex-wrap items-center justify-center gap-4 gap-y-8 sm:gap-8">
                        {logoCloudLogos.map((logo) => {
                            return (
                                <a
                                    href={logo.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    key={logo.icon.src}
                                    className="group"
                                >
                                    <img
                                        className="spin-on-hover h-8 rounded-full border border-n-1 object-contain dark:border-white sm:h-16"
                                        src={logo.icon.src}
                                        alt="Logo"
                                        loading="eager"
                                    />
                                </a>
                            )
                        })}
                    </div>
                </div>

                <div className="center-xy z-index-1 relative hidden w-1/3 items-center justify-center overflow-hidden border-l-2 border-black bg-purple-1 py-3 lg:flex lg:pb-16 lg:pt-16 ">
                    <img
                        src={assets.PEANUTMAN_HAPPY.src}
                        className="absolute duration-200 hover:rotate-12"
                        alt="Peanutman Cheering"
                    />
                </div>
            </div>

            <div className="grid w-full grid-cols-1  gap-4 px-4 py-2 text-black lg:grid-cols-3">
                <label className="flex items-center justify-center border border-n-2 bg-pink-1 px-4 py-8 text-center text-h3 font-black sm:px-16">
                    300k+ Transactions
                </label>

                <label className="flex items-center justify-center border border-n-2 bg-yellow-1 px-4 py-8 text-center text-h3 font-black sm:px-16">
                    105k+ Unique wallet addresses
                </label>

                <label className="flex items-center justify-center border border-n-2 bg-green-1 px-4 py-8 text-center  text-h3 font-black sm:px-16">
                    20+ Chains
                </label>
            </div>
            <div className="w-full px-4 text-black">
                <div className="flex w-full flex-col items-center justify-between gap-4 border border-n-2 bg-purple-1 py-8 lg:flex-row ">
                    <div className="relative flex items-center justify-center px-8 lg:h-1/3 lg:w-1/3">
                        <a href="https://docs.peanut.to/overview/what-are-links" target="_blank">
                            <img
                                src={assets.TEAL_MOCKUP_1.src}
                                className="brutalborder brutalshadow mx-2 h-full w-64 object-cover sm:w-full"
                                alt="Peanutman Cheering"
                                loading="eager"
                            />
                        </a>
                    </div>
                    <div className="flex w-full flex-col items-center justify-center gap-4 px-8 text-center">
                        <h1 className="text-h1">P2P links</h1>
                        <div className="w-3/4 text-h5 font-normal ">
                            Forget chains and wallet addresses. Do a peer 2 peer transfer with a trustless payment link,
                            no matter whether the recipient has a wallet.{' '}
                        </div>

                        <div className="mt-4 flex w-full items-center justify-center gap-4">
                            <a
                                data-cal-link="kkonrad+hugo0/15min?duration=30"
                                data-cal-config='{"layout":"month_view"}'
                                className="btn-purple-2 btn-xl cursor-pointer px-4 text-h4 md:w-3/5 lg:w-1/3"
                            >
                                Let's talk!
                            </a>
                            <Link href={'/send'} className="text-h4 underline">
                                Use app →
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
            <div className="w-full px-4 text-black">
                <div className="flex w-full flex-col items-center justify-between gap-4 border border-n-2 bg-yellow-1 py-8 lg:flex-row-reverse ">
                    <div className="relative flex items-center justify-center px-8 lg:h-1/3 lg:w-1/3">
                        <a
                            href="https://docs.peanut.to/overview/case-studies/raffles-to-boost-uwas-and-transactions"
                            target="_blank"
                        >
                            <div className="mx-2 flex h-full items-center justify-center object-cover">
                                <Lottie
                                    options={defaultLottieOptions}
                                    height={600}
                                    width={400}
                                    // TODO: update on mobile
                                />
                            </div>
                        </a>
                    </div>
                    <div className="flex w-full flex-col items-center justify-center gap-4 px-8 text-center">
                        <h1 className="text-h1">Raffle links</h1>
                        <div className="w-3/4 text-h5 font-normal ">
                            Engage your audience with exciting raffles! Create the raffles easily using our APP or SDK.
                        </div>

                        <div className="mt-4 flex w-full items-center justify-center gap-4">
                            <a
                                data-cal-link="kkonrad+hugo0/15min?duration=30"
                                data-cal-config='{"layout":"month_view"}'
                                className="btn-purple btn-xl cursor-pointer px-4 text-h4 md:w-3/5 lg:w-1/3"
                            >
                                Let's talk!
                            </a>
                            <Link href={'/raffle/create'} className="text-h4 underline">
                                Use app →
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            <div className="w-full border-y-[1px] border-black bg-white py-3">
                <MarqueeWrapper backgroundColor="bg-white" direction="right">
                    {Object.entries(chain_logos).map(([chain, logo]) => {
                        return (
                            <div className="pl-3 " key={chain}>
                                <img loading="eager" src={logo.src} className="h-16 w-16" />
                            </div>
                        )
                    })}
                </MarqueeWrapper>
            </div>

            <section className="lg:divide-y" id="features">
                <div className="brutalborder-y grid grid-cols-1 gap-4 overflow-hidden bg-white p-4 text-black sm:mx-0 sm:grid-cols-2 md:grid-cols-3">
                    {features.map((feature, index) => {
                        return (
                            <div
                                key={index}
                                className={`brutalborder flex flex-col border-2 border-black p-4 text-center sm:p-12 sm:px-16 ${feature.bg}`}
                                id="app"
                            >
                                <h3 className="mb-4 text-5xl font-black"> {feature.name}</h3>
                                <p className="mt-1 block text-2xl leading-loose">{feature.description}</p>
                                <div className="flex-grow"></div>
                                <div className="center-xy flex-end my-6 flex items-center justify-around">
                                    {feature.calModal && (
                                        <button className="btn btn-shadow btn-xl cursor-pointer bg-white p-4 px-4 text-2xl font-black ">
                                            <a
                                                data-cal-link="kkonrad+hugo0/15min?duration=30"
                                                data-cal-config='{"layout":"month_view"}'
                                            >
                                                Let's talk!
                                            </a>
                                        </button>
                                    )}
                                    {feature.primaryRedirectUrl ? (
                                        feature.calModal ? (
                                            <a
                                                href={feature.primaryRedirectUrl}
                                                target="_blank"
                                                className="p-5 text-xl font-black text-black hover:no-underline sm:text-2xl"
                                            >
                                                {feature.primaryRedirectText} →
                                            </a>
                                        ) : (
                                            <button className="brutalborder brutalshadow btn-shadow cursor-pointer bg-white p-4 px-4 text-2xl font-black ">
                                                <a
                                                    href={feature.primaryRedirectUrl}
                                                    target="_blank"
                                                    className="text-black no-underline"
                                                >
                                                    {feature.primaryRedirectText}
                                                </a>
                                            </button>
                                        )
                                    ) : (
                                        ''
                                    )}
                                    {feature.secondaryRedirectUrl && (
                                        <a
                                            href={feature.secondaryRedirectUrl}
                                            target="_blank"
                                            className="p-5 text-xl font-black text-black sm:text-2xl "
                                        >
                                            {feature.secondaryRedirectText} →
                                        </a>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </section>

            <div className="flex w-full flex-col items-center justify-center ">
                <MarqueeWrapper backgroundColor="bg-black" direction="right">
                    <>
                        <div className="mr-2 py-2 text-center font-black uppercase italic tracking-wide text-white md:py-4 md:text-4xl">
                            GO
                        </div>
                        <img loading="eager" src={assets.SMILEY_ICON.src} alt="logo" className=" mr-1 h-5 md:h-8" />
                        <div className="mr-2 py-2 text-center font-black uppercase italic tracking-wide text-white md:py-4 md:text-4xl">
                            NUTS
                        </div>
                        <img loading="eager" src={assets.SMILEY_ICON.src} alt="logo" className="mr-1 h-5 md:h-8" />
                    </>
                </MarqueeWrapper>

                <div className="w-full border-y-[1px] border-black bg-green-1 px-4">
                    <div className="brutalborder-top flex w-full flex-col gap-4 px-4 py-4 text-black">
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

                <MarqueeWrapper backgroundColor="bg-black" direction="right">
                    <>
                        <img loading="eager" src={assets.SMILEY_ICON.src} alt="logo" className=" mr-1 h-5 md:h-8" />
                        <div className="mr-2 py-2 text-center font-black uppercase italic tracking-wide text-white md:py-4 md:text-4xl">
                            FRENS
                        </div>
                    </>
                </MarqueeWrapper>
            </div>

            <div role="list" className="grid:cols-1 grid gap-4 px-4 text-black md:grid-cols-2 lg:grid-cols-4">
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

export default Welcome
