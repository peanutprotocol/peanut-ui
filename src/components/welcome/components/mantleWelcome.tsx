'use client'
import * as global_components from '@/components/global'
import * as components from '@/components'
import smiley from '@/assets/icons/smiley.svg'
import sbf_image from '@/assets/people/sbf.jpeg'
import teal_wallet_one from '@/assets/mockups/teal-wallet-1.png'
import dropdown_svg from '@/assets/icons/dropdown.svg'
import derek from '@/assets/people/derek.png'
import sharuk from '@/assets/people/sharuk.png'
import kofime_icon from '@/assets/people/kofime-icon.jpeg'
import { useState, useEffect, Fragment } from 'react'
import { getCalApi } from '@calcom/embed-react'
import Lottie from 'react-lottie'
import redpacketLottie from '@/assets/lottie/redpacket-lottie.json'
import { isMobile } from 'react-device-detect'
import { Transition, Dialog } from '@headlessui/react'

const features = [
    {
        name: 'Raffle ',
        description: '2-10k slots with random amounts per red pack',
        bg: 'bg-yellow',
        primaryRedirectUrl: 'https://docs.peanut.to/overview/case-studies/raffles-to-boost-uwas-and-transactions', //TODO: update link
        primaryRedirectText: 'Docs',
    },
    {
        name: 'ERC-20',
        description: 'Multiple ERC-20s tokens per red pack',
        bg: 'bg-teal',
        primaryRedirectUrl: 'https://docs.peanut.to/integrate/sdk/getting-started-with-the-sdk', //TODO: update link
        primaryRedirectText: 'Docs',
    },
    {
        name: 'Your Brand',
        description: 'Use web app or white-label (self-service or integration fee)',
        bg: 'bg-red',
        calModal: true,
        primaryRedirectUrl: 'https://docs.peanut.to/integrate/sdk/branded-links', //TODO: update link
        primaryRedirectText: 'Case study',
    },
    {
        name: 'Gasless',
        description: 'Seamlessly sponsor gas for claiming!',
        bg: 'bg-lightblue',
        primaryRedirectUrl: 'https://experimental.peanut.to/send',
        primaryRedirectText: 'Try Now',
        secondaryRedirectUrl: 'https://docs.peanut.to/integrate/sdk/claim/claim-link-gasless',
        secondaryRedirectText: 'Learn more',
    },
    {
        name: 'Non-custodial & Audited',
        description: 'Audited, open source, non-custodial',
        bg: 'bg-fuchsia',
        calModal: true,
    },
    {
        name: 'Sybil-resistant',
        description: 'One slot per wallet address',
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
        answer: 'You can always reclaim the link to the sender wallet. See ',
        redirectUrl: 'https://peanut.to/reclaim',
        redirectText: 'here.',
    },
    {
        question: 'What are the fees?',
        answer: 'On our dapp, we sponsor gasless claiming and sending on L2s. Integrators can choose to sponsor the transactions. We do not have a fee on the protocol, see ',
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
    {
        question: 'How many slots per raffle?',
        answer: 'Up to 250 for a simple red packet, or use this guide [link[ for large red packets, with up to 10k slots.',
    }, //TODO: update link
    {
        question: 'Which tokens can I use? Can I use multiple tokens?',
        answer: 'Yes, any ERC-20. Yes, use this guide for multi-token Red Packets',
    },
    { question: 'I want to run a large campaign. Help?', answer: 'OK, ', calModal: true },
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

export function WelcomeMantle() {
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

    const [showIframe, setShowIframe] = useState(false)

    return (
        <div className="mt-0 flex h-full min-h-[100vh] flex-col  ">
            {/* hero */}
            <div className="flex border-2 border-black bg-white text-black">
                <div className="w-full bg-white py-8 text-center sm:px-6 sm:py-16 lg:mx-0 lg:px-0">
                    <h1 className="mx-auto mb-8 mt-0 flex w-3/4 flex-row items-center justify-center gap-2 text-5xl font-black sm:text-6xl">
                        Red Packets
                    </h1>

                    <div className="m-4 mx-auto w-3/4 p-2 text-xl">
                        Reward and engage your community for the Lunar New Year
                    </div>

                    <div className="mt-8 flex justify-center space-x-4 p-2 sm:gap-4">
                        <a
                            href="https://twitter.com/0xMantle/status/1757390410669023248?t=og2A7MIeovDLGKfCQ2wxOw&s=19"
                            id="cta-btn"
                            target="blank"
                            className="mb-2 block cursor-pointer bg-white p-5 text-2xl font-black md:w-3/5 lg:w-1/3"
                        >
                            Discover!
                        </a>

                        <a
                            href="https://docs.peanut.to"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-5  text-xl font-black text-black hover:no-underline sm:text-2xl"
                        >
                            Run your own campaign →
                        </a>
                    </div>
                </div>
                <div className="center-xy brutalborder-x z-index-1 relative hidden w-1/3 items-center justify-center overflow-hidden bg-fuchsia lg:flex ">
                    <Lottie options={defaultLottieOptions} height={isMobile ? 200 : 400} width={isMobile ? 125 : 250} />
                </div>
            </div>

            {/* seperator */}
            <global_components.MarqueeWrapper backgroundColor="bg-black" direction="right">
                <>
                    <div className="mr-2 py-2 text-center font-black uppercase italic tracking-wide text-white md:py-4 md:text-4xl">
                        DISCOVER
                    </div>
                    <img src={smiley.src} alt="logo" className=" mr-1 h-5 md:h-8" />
                    <div className="mr-2 py-2 text-center font-black uppercase italic tracking-wide text-white md:py-4 md:text-4xl">
                        DISCOVER
                    </div>
                    <img src={smiley.src} alt="logo" className="mr-1 h-5 md:h-8" />
                </>
            </global_components.MarqueeWrapper>

            {/* how it works */}
            <div className=" flex flex-col gap-4 bg-white p-4">
                <div className="brutalborder flex flex-col items-center justify-center gap-6 border-2 border-black bg-red py-8 text-black sm:py-16 lg:flex-row-reverse">
                    {/* right column */}
                    <div className=" relative flex h-full w-2/3 items-center justify-center  ">
                        <div className=" relative flex w-full items-center justify-center   ">
                            <div
                                id="cta-div"
                                className=" brutalborder relative flex w-3/4 items-center justify-center bg-white p-6   "
                            >
                                <components.Leaderboard />
                            </div>{' '}
                        </div>
                    </div>
                    {/* left column */}
                    <div className=" flex w-full flex-col gap-2 text-center sm:gap-8 sm:px-6 lg:mx-0 lg:w-2/3 lg:max-w-none lg:px-0">
                        <h1 className="mx-auto my-0 w-3/4  pt-4 text-5xl font-black">Get whitelisted!</h1>
                        <div className="mx-auto w-3/4 pb-4 text-xl ">
                            Be the first to be informed about future airdrops and raffles!{' '}
                        </div>

                        <div className="mt-8 flex justify-center space-x-4 p-2 sm:gap-4">
                            <div
                                onClick={() => {
                                    setShowIframe(!showIframe)
                                }}
                                id="cta-btn"
                                className="mb-2 block cursor-pointer bg-white p-5 text-2xl font-black no-underline md:w-3/5 lg:w-1/3"
                            >
                                Subscribe!
                            </div>

                            <a
                                href="https://docs.peanut.to"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-5 text-xl font-black text-black hover:no-underline sm:text-2xl"
                            >
                                Learn more →
                            </a>
                        </div>
                    </div>
                </div>
                <div className="brutalborder flex flex-col items-center justify-center gap-6 border-2 border-black bg-teal py-8 text-black sm:py-16 lg:flex-row">
                    {/* right column */}
                    <div className=" relative flex items-center justify-center px-8 lg:h-1/3 lg:w-1/3   ">
                        <a href="https://docs.peanut.to/overview/wallet-integrations/figma-flow" target="_blank">
                            <img
                                src={teal_wallet_one.src} //TODO: update with correct mockup
                                className="brutalborder brutalshadow mx-2 h-full w-64 object-cover sm:w-full"
                                alt="Peanutman Cheering"
                            />
                        </a>
                    </div>
                    {/* left column */}
                    <div className=" flex w-full flex-col gap-2 text-center sm:gap-8 sm:px-6 lg:mx-0 lg:w-2/3 lg:max-w-none lg:px-0">
                        <h1 className="mx-auto my-0 w-3/4  pt-4 text-5xl font-black">Build your own campaigns</h1>
                        <div className="mx-auto w-3/4 pb-4 text-xl ">
                            Build your own campaigns or integrate Peanut features seamlessly
                        </div>

                        <div className="mt-8 flex justify-center gap-1 space-x-4 p-2 sm:gap-4">
                            <a
                                data-cal-link="kkonrad+hugo0/15min?duration=30"
                                data-cal-config='{"layout":"month_view"}'
                                id="cta-btn"
                                className="mb-2 block cursor-pointer bg-white p-5 text-2xl font-black md:w-3/5 lg:w-1/3"
                            >
                                Let's talk!
                            </a>

                            <a
                                href="https://docs.peanut.to" //TODO: update to redpacket implementation guide?
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-5 text-xl font-black text-black hover:no-underline sm:text-2xl"
                            >
                                Integrate →
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            {/* seperator */}
            <global_components.MarqueeWrapper backgroundColor="bg-black" direction="right">
                <>
                    <div className="mr-2 py-2 text-center font-black uppercase italic tracking-wide text-white md:py-4 md:text-4xl">
                        COOL
                    </div>
                    <img src={smiley.src} alt="logo" className=" mr-1 h-5 md:h-8" />
                    <div className="mr-2 py-2 text-center font-black uppercase italic tracking-wide text-white md:py-4 md:text-4xl">
                        THINGS
                    </div>
                    <img src={smiley.src} alt="logo" className="mr-1 h-5 md:h-8" />
                </>
            </global_components.MarqueeWrapper>

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
            <global_components.MarqueeWrapper backgroundColor="bg-black">
                <>
                    <div className="mr-2 py-2 text-center font-black uppercase italic tracking-wide text-white md:py-4 md:text-4xl">
                        GO
                    </div>
                    <img src={smiley.src} alt="logo" className=" mr-1 h-5 md:h-8" />
                    <div className="mr-2 py-2 text-center font-black uppercase italic tracking-wide text-white md:py-4 md:text-4xl">
                        NUTS
                    </div>
                    <img src={smiley.src} alt="logo" className="mr-1 h-5 md:h-8" />
                </>
            </global_components.MarqueeWrapper>

            {/* faq */}
            <div className="flex flex-col gap-4 px-4 py-4 text-black">
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
                    <img src={smiley.src} alt="logo" className=" mr-1 h-5 md:h-8" />
                    <div className="mr-2 py-2 text-center font-black uppercase italic tracking-wide text-white md:py-4 md:text-4xl">
                        FRENS
                    </div>
                    <img src={smiley.src} alt="logo" className="mr-1 h-5 md:h-8" />
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

            <Transition.Root show={showIframe} as={Fragment}>
                <Dialog
                    as="div"
                    className="relative z-10 "
                    onClose={() => {
                        setShowIframe(false)
                    }}
                >
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-300"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-black bg-opacity-75 transition-opacity" />
                    </Transition.Child>
                    <div className="fixed inset-0 z-10 overflow-y-auto">
                        <div className="flex min-h-full min-w-full items-end justify-center text-center sm:items-center ">
                            <Transition.Child
                                as={Fragment}
                                enter="ease-out duration-300"
                                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                                enterTo="opacity-100 translate-y-0 sm:scale-100"
                                leave="ease-in duration-200"
                                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            >
                                <Dialog.Panel className="brutalborder relative my-24 h-full w-full min-w-[580px] max-w-[580px] transform overflow-hidden rounded-lg rounded-none bg-white text-left text-black shadow-xl  transition-all ">
                                    <div className="flex h-full flex-col items-center justify-center gap-2 ">
                                        <iframe
                                            src="https://docs.google.com/forms/d/e/1FAIpQLSdrDAnvpuVb-Yr2fuehjTQTMkjMvraDe7WUvCXhUjYaZoiboA/viewform?embedded=true"
                                            className="h-[500px] w-full "
                                        >
                                            Loading…
                                        </iframe>
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition.Root>
        </div>
    )
}
