'use client'
import { useState, useEffect } from 'react'
import { getCalApi } from '@calcom/embed-react'
import Link from 'next/link'
import Lottie from 'react-lottie'
import { isMobile } from 'react-device-detect'
import * as global_components from '@/components/global'

//chains
import * as chain_logos from '@/assets/chains'

//testimonials
import sbf_image from '@/assets/people/sbf.jpeg'
import derek from '@/assets/people/derek.png'
import sharuk from '@/assets/people/sharuk.png'
import kofime_icon from '@/assets/people/kofime-icon.jpeg'

//partners
import wallet_connect_logo from '@/assets/logos/partners/wallet-connect-logo.png'
import clave_logo from '@/assets/logos/integrators/clave-logo-2.jpeg'
import brume_logo from '@/assets/logos/integrators/brume-logo.png'
import eco_logo from '@/assets/logos/integrators/eco-logo.png'
import mantle_logo from '@/assets/chains/mantle.svg'
import bybit_logo from '@/assets/logos/partners/bybit-logo.jpeg'
import woofi_logo from '@/assets/logos/partners/woofi-logo-2.webp'
import timeswap_logo from '@/assets/logos/partners/timeswap-logo.jpeg'
import cleo_logo from '@/assets/logos/partners/cleo-logo.jpeg'
import ktx_logo from '@/assets/logos/partners/ktx-logo.jpeg'
import lendle_logo from '@/assets/logos/partners/lendle-logo.jpeg'
import izumi_logo from '@/assets/logos/partners/izumi-logo.jpeg'
import logx_logo from '@/assets/logos/partners/logx-logo.jpeg'

//investors
import nazare_logo from '@/assets/logos/investors/nazare-logo.svg'
import hypersphere_logo from '@/assets/logos/investors/hypersphere-logo-2.png'
import zeeprime_logo from '@/assets/logos/investors/zeeprime-logo-3.png'
import longhash_logo from '@/assets/logos/investors/longhash-logo-2.png'

//mockups
import teal_wallet_one from '@/assets/mockups/teal-wallet-1.png'
import teal_wallet_two from '@/assets/mockups/teal-wallet-2.png'

//icons
import dropdown_svg from '@/assets/icons/dropdown.svg'
import smiley from '@/assets/icons/smiley.svg'
import peanutman_happy from '@/assets/peanut/peanutman-happy.svg'

//lottie
import redpacketLottie from '@/assets/lottie/redpacket-lottie.json'

const logoCloudLogos = [
    { icon: wallet_connect_logo, link: 'https://walletconnect.com/' },
    { icon: clave_logo, link: 'https://www.getclave.io/' },
    { icon: brume_logo, link: 'https://bento.me/brume' },
    { icon: eco_logo, link: 'https://eco.org/?ref=com' },
    { icon: mantle_logo, link: 'https://www.mantle.xyz/' },
    { icon: woofi_logo, link: 'https://woo.org/' },
    { icon: timeswap_logo, link: 'https://timeswap.io/' },
    { icon: cleo_logo, link: 'https://cleo.exchange/swap' },
    { icon: ktx_logo, link: 'https://ktx.finance/' },
    { icon: lendle_logo, link: 'https://lendle.xyz/' },
    { icon: izumi_logo, link: 'https://izumi.finance/' },
    { icon: logx_logo, link: 'https://www.logx.trade/' },
    { icon: bybit_logo, link: 'https://www.bybit.com/' },
]

const backedByLogos = [
    { icon: hypersphere_logo, link: 'https://hypersphere.vc/' },
    { icon: zeeprime_logo, link: 'https://zeeprime.capital/' },
    { icon: longhash_logo, link: 'https://www.longhash.vc/' },
    { icon: nazare_logo, link: 'https://nazare.capital/' },
]

const features = [
    {
        name: 'Brand ',
        description:
            'Your brand deserves to be front and center for new users. It’s nuts but you can completely whitelabel these links and use your own domain and branding.',
        bg: 'bg-yellow',
        primaryRedirectUrl: 'https://docs.peanut.to/integrations/domain-agnostic-links',
        primaryRedirectText: 'Docs',
    },
    {
        name: 'Gasless',
        description:
            'Users should not have to worry about gas, being on the right chain or wallet addresses. Claim and send links solve the cold start problem.',
        bg: 'bg-teal',
        primaryRedirectUrl:
            'https://docs.peanut.to/sdk-documentation/building-with-the-sdk/claiming-peanut-links-gaslessly',
        primaryRedirectText: 'Docs',
    },
    {
        name: 'Welcome packs',
        description: 'Send a welcome pack of NFT + gas + token to new or existing customers',
        bg: 'bg-red',
        calModal: true,
        primaryRedirectUrl: 'https://docs.peanut.to/overview/use-cases',
        primaryRedirectText: 'Case study',
    },
    {
        name: 'Cross-chain',
        description:
            'Customize token and claim page to match your branding with logo and colors. Or even better, have the users claim the tokens on your own domain or app!',
        bg: 'bg-lightblue',
        primaryRedirectUrl: 'https://experimental.peanut.to/send',
        primaryRedirectText: 'Try Now',
        secondaryRedirectUrl: 'https://docs.peanut.to/sdk-documentation/building-with-the-sdk/x-chain-links',
        secondaryRedirectText: 'Learn more',
    },
    {
        name: 'Get Physical',
        description: 'Are you planning an IRL event? Do a physical airdrop by distributing QR codes with tokens.',
        bg: 'bg-fuchsia',
        calModal: true,
    },
    {
        name: 'Web2 Airdrops',
        description: 'Airdrop your web2 audience (think Discord, Mailchimp, Twitter)',
        bg: 'bg-yellow',
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
        redirectUrl: 'https://peanut.to/reclaim',
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
        redirectUrl: 'https://docs.peanut.to',
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
        imageSrc: derek.src,
        altText: 'picture of chad',
        comment: 'How did this not exist before?! Great UX!',
        name: 'Derek Rein',
        detail: 'WalletConnect',
        detailRedirectUrl: 'https://walletconnect.com/',
        bgColorClass: 'bg-yellow',
    },
    {
        imageSrc: sharuk.src,
        altText: 'eco man',
        comment: 'Peanut allows us to elegantly solve the cold start problem!',
        name: 'shahrukh Rao',
        detail: 'Eco',
        detailRedirectUrl: 'https://eco.org/?ref=com',
        bgColorClass: 'bg-fuchsia',
    },
    {
        imageSrc: kofime_icon.src,
        altText: 'kofi',
        comment: 'Very buttery experience!',
        name: 'Kofi.me',
        detail: 'Kofi.me',
        detailRedirectUrl: 'https://www.kofime.xyz/',
        bgColorClass: 'bg-lightblue',
    },
    {
        imageSrc: sbf_image.src,
        altText: 'picture of pixel art SBF',
        comment: 'I have a peanut allergy. Help!',
        name: 'CEx CEO',
        detail: 'Probably FTX',
        bgColorClass: 'bg-red',
    },
]

export function Welcome() {
    const [openedFaq, setOpenedFaq] = useState<number | null>(null)

    function classNames(...classes: any) {
        return classes.filter(Boolean).join(' ')
    }

    const defaultLottieOptions = {
        loop: true,
        autoplay: true,
        animationData: redpacketLottie,
        rendererSettings: {
            preserveAspectRatio: 'xMidYMid slice',
        },
    }

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

    return (
        <div className="mt-0 flex h-full min-h-[100vh] flex-col  ">
            {/* hero */}
            <div className="flex border-2 border-black bg-white text-black">
                <div className="w-full bg-white py-8 text-center sm:px-6 sm:py-16 lg:mx-0 lg:w-2/3 lg:max-w-none lg:px-0">
                    <h1 className="mx-auto mb-8 mt-0 flex w-3/4 flex-row items-center justify-center gap-2 text-5xl font-black sm:text-6xl">
                        Send{' '}
                        <div className="scroller w-[175px]">
                            <span>
                                NFTs
                                <br />
                                USDC
                                <br />
                                DAI
                                <br />
                                PEPE
                            </span>
                        </div>
                    </h1>
                    <h1 className="mx-auto mb-8 mt-0 flex w-3/4 flex-row items-center justify-center gap-2 text-5xl font-black sm:text-6xl">
                        Via Link
                        {/* <div className="scroller w-[315px]">
                            <span>
                                Whatsapp
                                <br />
                                Link
                                <br />
                                Telegram
                                <br />
                                Twitter
                            </span>
                        </div> */}
                    </h1>

                    <div className="m-4 mx-auto w-3/4 p-2 text-xl">
                        Go viral with claim links. Let your users send tokens through links
                    </div>

                    <div className="mt-8 flex justify-center space-x-4 p-2 sm:gap-4">
                        <a
                            data-cal-link="kkonrad+hugo0/15min?duration=30"
                            data-cal-config='{"layout":"month_view"}'
                            id="cta-btn"
                            className="mb-2 block cursor-pointer bg-white p-5 text-2xl font-black md:w-3/5 lg:w-1/3"
                        >
                            Let's talk!
                        </a>

                        <a
                            href="https://docs.peanut.to"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-5  text-xl font-black text-black hover:no-underline sm:text-2xl"
                        >
                            Integrate →
                        </a>
                    </div>

                    <div className="mx-5 mt-12 flex flex-row flex-wrap items-center justify-center gap-8 gap-y-8">
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
                                        className="brutalborder spin-on-hover h-16 rounded-full object-contain"
                                        src={logo.icon.src}
                                        alt="Logo"
                                        loading="eager"
                                    />
                                </a>
                            )
                        })}
                    </div>
                </div>

                <div className="center-xy brutalborder-x z-index-1 relative hidden w-1/3 items-center justify-center overflow-hidden bg-fuchsia py-3 lg:flex lg:pb-16 lg:pt-16 ">
                    <img
                        src={peanutman_happy.src}
                        className="absolute  duration-200 hover:rotate-12"
                        alt="Peanutman Cheering"
                    />
                </div>
            </div>

            {/* seperator */}
            {/* <div className="brutalborder-y">
                <global_components.MarqueeWrapper backgroundColor="bg-white">
                    {Object.entries(chain_logos).map(([chain, logo]) => {
                        return (
                            <div className="pb-5 pl-3 pt-5" key={chain}>
                                <img loading='eager'src={logo.default.src} className="h-16 w-16" />
                            </div>
                        )
                    })}
                </global_components.MarqueeWrapper>
            </div> */}

            {/* how it works */}
            <div className="brutalborder-y flex flex-col gap-4 bg-white p-4">
                <div className="grid grid-cols-1 gap-4 overflow-hidden bg-white text-black sm:mx-0 lg:grid-cols-3">
                    <div
                        className={
                            'brutalborder flex flex-col border-2 border-black bg-yellow p-4 text-center sm:p-6 sm:px-16'
                        }
                        id="app"
                    >
                        <h3 className="text-5xl font-black">200k Users</h3>
                    </div>
                    <div
                        className={classNames(
                            'brutalborder flex flex-col border-2 border-black bg-teal p-4 text-center sm:p-6 sm:px-16'
                        )}
                        id="app"
                    >
                        <h3 className="text-5xl font-black"> 500k Volume</h3>
                    </div>
                    <div
                        className={classNames(
                            'brutalborder flex flex-col border-2 border-black bg-red p-4 text-center sm:p-6 sm:px-16'
                        )}
                        id="app"
                    >
                        <h3 className="text-5xl font-black"> 23 Chains</h3>
                    </div>
                </div>
                <div className="brutalborder flex flex-col items-center justify-center gap-6 border-2 border-black bg-red py-8 text-black sm:py-16 lg:flex-row-reverse">
                    {/* right column */}
                    <div className=" relative flex items-center justify-center px-8 lg:h-1/3 lg:w-1/3   ">
                        <a href="https://docs.peanut.to/overview/wallet-integrations/figma-flow" target="_blank">
                            <div className="brutalborder brutalshadow sm:h-600 h-400 mx-2 flex h-full items-center justify-center bg-white object-cover">
                                <Lottie
                                    options={defaultLottieOptions}
                                    height={isMobile ? 400 : 600}
                                    width={isMobile ? 250 : 400}
                                />
                            </div>
                        </a>
                    </div>
                    {/* left column */}
                    <div className=" flex w-full flex-col gap-2 text-center sm:gap-8 sm:px-6 lg:mx-0 lg:w-2/3 lg:max-w-none lg:px-0">
                        <h1 className="mx-auto my-0 w-3/4  pt-4 text-5xl font-black">Raffle links</h1>
                        <div className="mx-auto w-3/4 pb-4 text-xl ">
                            Engage your audience with exciting raffles! Create the raffles easily using our APP or SDK.
                        </div>

                        <div className="mt-8 flex justify-center space-x-4 p-2 sm:gap-4">
                            <a
                                data-cal-link="kkonrad+hugo0/15min?duration=30"
                                data-cal-config='{"layout":"month_view"}'
                                id="cta-btn"
                                className="mb-2 block cursor-pointer bg-white p-5 text-2xl font-black md:w-3/5 lg:w-1/3"
                            >
                                Let's talk!
                            </a>
                            <Link
                                href={'/raffle/create'}
                                className="p-5 text-xl font-black text-black hover:no-underline sm:text-2xl"
                            >
                                Use app →
                            </Link>
                        </div>
                    </div>
                </div>
                <div className="brutalborder flex flex-col items-center justify-center gap-6 border-2 border-black bg-teal py-8 text-black sm:py-16 lg:flex-row">
                    {/* right column */}
                    <div className=" relative flex items-center justify-center px-8 lg:h-1/3 lg:w-1/3   ">
                        <a href="https://docs.peanut.to/overview/wallet-integrations/figma-flow" target="_blank">
                            <img
                                src={teal_wallet_one.src}
                                className="brutalborder brutalshadow mx-2 h-full w-64 object-cover sm:w-full"
                                alt="Peanutman Cheering"
                            />
                        </a>
                    </div>
                    {/* left column */}
                    <div className=" flex w-full flex-col gap-2 text-center sm:gap-8 sm:px-6 lg:mx-0 lg:w-2/3 lg:max-w-none lg:px-0">
                        <h1 className="mx-auto my-0 w-3/4  pt-4 text-5xl font-black">P2P links</h1>
                        <div className="mx-auto w-3/4 pb-4 text-xl ">
                            Forget chains and wallet addresses. Do a peer 2 peer transfer with a trustless payment link,
                            no matter whether the recipient has a wallet.
                        </div>

                        <div className="mt-8 flex justify-center space-x-4 p-2 sm:gap-4">
                            <a
                                data-cal-link="kkonrad+hugo0/15min?duration=30"
                                data-cal-config='{"layout":"month_view"}'
                                id="cta-btn"
                                className="mb-2 block cursor-pointer bg-white p-5 text-2xl font-black md:w-3/5 lg:w-1/3"
                            >
                                Let's talk!
                            </a>
                            <Link
                                href={'/send'}
                                className="p-5 text-xl font-black text-black hover:no-underline sm:text-2xl"
                            >
                                Use app →
                            </Link>
                        </div>
                    </div>
                </div>
                {/* <div className="brutalborder flex flex-col items-center justify-center gap-6 border-2 border-black bg-fuchsia py-8 text-black sm:py-16 lg:flex-row-reverse">
                    <div className=" relative flex items-center justify-center px-8 lg:h-1/3 lg:w-1/3   ">
                        <a href="https://docs.peanut.to/overview/wallet-integrations/figma-flow" target="_blank">
                            <img
                                src={teal_wallet_two.src}
                                className="brutalborder brutalshadow mx-2 h-full w-64 object-cover sm:w-full"
                                alt="Peanutman Cheering"
                            />
                        </a>
                    </div>
                    <div className=" flex w-full flex-col gap-2 text-center sm:gap-8 sm:px-6 lg:mx-0 lg:w-2/3 lg:max-w-none lg:px-0">
                        <h1 className="mx-auto my-0 w-3/4  pt-4 text-5xl font-black">Claim and send gaslessly</h1>
                        <div className="mx-auto w-3/4 pb-4 text-xl ">
                            Onboard new users seamlessly with a gassless sending and onboarding experience.
                        </div>

                        <div className="mt-8 flex justify-center space-x-4 p-2 sm:gap-4">
                            <a
                                data-cal-link="kkonrad+hugo0/15min?duration=30"
                                data-cal-config='{"layout":"month_view"}'
                                id="cta-btn"
                                className="mb-2 block cursor-pointer bg-white p-5 text-2xl font-black md:w-3/5 lg:w-1/3"
                            >
                                Let's talk!
                            </a>

                            <a
                                href="https://docs.peanut.to"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-5 text-xl font-black text-black hover:no-underline sm:text-2xl"
                            >
                                Integrate →
                            </a>
                        </div>
                    </div>
                </div> */}
            </div>

            {/* seperator */}
            <div className="">
                <global_components.MarqueeWrapper backgroundColor="bg-white" direction="right">
                    {Object.entries(chain_logos).map(([chain, logo]) => {
                        return (
                            <div className="pb-5 pl-3 pt-5" key={chain}>
                                <img loading="eager" src={logo.default.src} className="h-16 w-16" />
                            </div>
                        )
                    })}
                </global_components.MarqueeWrapper>
            </div>

            {/* features */}
            <section className="lg:divide-y" id="features">
                <div className="brutalborder-y grid grid-cols-1 gap-4 overflow-hidden bg-white p-4 text-black sm:mx-0 sm:grid-cols-2 md:grid-cols-3">
                    {features.map((feature, index) => {
                        return (
                            <div
                                className={classNames(
                                    'brutalborder flex flex-col border-2 border-black p-4 text-center sm:p-12 sm:px-16 ',
                                    feature.bg
                                )}
                                id="app"
                            >
                                <h3 className="mb-4 text-5xl font-black"> {feature.name}</h3>
                                <p className="mt-1 block text-2xl leading-loose">{feature.description}</p>
                                <div className="flex-grow"></div>
                                <div className="center-xy flex-end my-6 flex justify-around">
                                    {feature.calModal && (
                                        <button className="brutalborder brutalshadow cursor-pointer bg-white p-4 px-4 text-2xl font-black ">
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
                                            <button className="brutalborder brutalshadow cursor-pointer bg-white p-4 px-4 text-2xl font-black ">
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

            {/* seperator */}
            <global_components.MarqueeWrapper backgroundColor="bg-black" direction="right">
                <>
                    <div className="mr-2 py-2 text-center font-black uppercase italic tracking-wide text-white md:py-4 md:text-4xl">
                        GO
                    </div>
                    <img loading="eager" src={smiley.src} alt="logo" className=" mr-1 h-5 md:h-8" />
                    <div className="mr-2 py-2 text-center font-black uppercase italic tracking-wide text-white md:py-4 md:text-4xl">
                        NUTS
                    </div>
                    <img loading="eager" src={smiley.src} alt="logo" className="mr-1 h-5 md:h-8" />
                </>
            </global_components.MarqueeWrapper>

            {/* backed by */}
            {/* <section className="lg:divide-y" id="backedby">
                <div className="flex w-full flex-col items-center justify-center gap-4 bg-white py-6">
                    <div>
                        <h3 className="my-2 text-2xl font-black text-black">Backed by</h3>
                    </div>
                    <div className="brutalborder-y mx-4 grid grid-cols-1 gap-4 overflow-hidden bg-white py-8 text-black md:grid-cols-4">
                        {backedByLogos.map((logo, index) => {
                            return (
                                <a
                                    href={logo.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    key={index}
                                    className="flex h-6 items-center justify-center md:h-12"
                                >
                                    <img
                                        className="h-auto max-h-full max-w-full object-contain"
                                        src={logo.icon.src}
                                        loading="eager"
                                    />
                                </a>
                            )
                        })}
                    </div>
                </div>
            </section> */}

            {/* faq */}
            <div className="brutalborder-top flex flex-col gap-4 px-4 py-4 text-black">
                <h2 className="my-0 px-8 font-bold">FAQ</h2>
                <div className="flex cursor-pointer flex-col gap-0">
                    {faqs.map((faq, idx) => (
                        <div
                            className={classNames(
                                'brutalborder-left brutalborder-top brutalborder-right rounded-none bg-white text-black ',
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
                                    src={dropdown_svg.src}
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
                                            <a href={faq.redirectUrl} target="_blank" className="text-black underline">
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

            {/* seperator */}
            <global_components.MarqueeWrapper backgroundColor="bg-black" direction="right">
                <>
                    <div className="mr-2 py-2 text-center font-black uppercase italic tracking-wide text-white md:py-4 md:text-4xl">
                        FRENS
                    </div>
                    <img loading="eager" src={smiley.src} alt="logo" className=" mr-1 h-5 md:h-8" />
                    <div className="mr-2 py-2 text-center font-black uppercase italic tracking-wide text-white md:py-4 md:text-4xl">
                        FRENS
                    </div>
                    <img loading="eager" src={smiley.src} alt="logo" className="mr-1 h-5 md:h-8" />
                </>
            </global_components.MarqueeWrapper>

            {/* testimonials */}
            <section id="testimonials" className=" brutalborder-y justify-center bg-white p-4 text-black ">
                <div role="list" className="grid:cols-1 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {testimonials.map((testimonial, index) => (
                        <div
                            key={index}
                            className={`${testimonial.bgColorClass} brutalborder  p-2 text-center`}
                            id="frens"
                        >
                            <img
                                //@ts-ignore
                                src={testimonial.imageSrc}
                                alt={testimonial.altText}
                                className="rainbow-border mx-auto w-1/2 rounded-full bg-white p-1"
                            />
                            <h1 className="mx-auto mt-2 h-12 py-2 text-base font-normal italic lg:text-lg">
                                {testimonial.comment}
                            </h1>
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
            </section>
        </div>
    )
}
