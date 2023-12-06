import * as global_components from '@/components/global'
import smiley from '@/assets/smiley.svg'
import peanutman_happy from '@/assets/peanutman-happy.svg'
import orest_image from '@/assets/people/orest.jpg'
import mydas_image from '@/assets/people/mydas.jpg'
import steven_image from '@/assets/people/Steven.jpg'
import sbf_image from '@/assets/people/sbf.jpeg'
import * as chain_logos from '@/assets/chains'
import beam_logo from '@/assets/logos/integrators/beam-logo.jpeg'
import eco_logo from '@/assets/logos/integrators/eco-logo.jpeg'
import kofime_logo from '@/assets/logos/integrators/kofime-logo.png'
import hypersphere_logo from '@/assets/logos/investors/hypersphere-logo.png'
import zeeprime_logo from '@/assets/logos/investors/zeeprime-logo.png'
import wallet_connect_logo from '@/assets/logos/wallet-connect-logo.png'
import teal_wallet_one from '@/assets/mockups/teal-wallet-1.png'
import teal_wallet_two from '@/assets/mockups/teal-wallet-2.png'
import dropdown_svg from '@/assets/dropdown.svg'
import derek from '@/assets/people/derek.png'
import sharuk from '@/assets/people/sharuk.png'
import kofime_icon from '@/assets/people/kofime-icon.jpeg'
import { useState, useEffect } from 'react'
import { getCalApi } from '@calcom/embed-react'

const logoCloudLogos = [hypersphere_logo, zeeprime_logo, wallet_connect_logo, beam_logo, eco_logo, kofime_logo]
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
            'Users should not have to worry about gas, being on the right chain or wallet addresses. Claim links solve the cold start problem.',
        bg: 'bg-fuchsia',
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
        description:
            'Are you planning an IRL event? Do a physical airdrop by distributing QR codes with tokens. Just put stickers on your swag or flyers and boost your conversion rate.',
        bg: 'bg-teal',
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
        answer: 'You can always withdraw or cancel your own links. See how ',
        redirectUrl: 'https://docs.peanut.to/sdk-documentation/building-with-the-sdk/reclaiming-links',
        redirectText: 'here.',
    },
    {
        question: 'What are the fees?',
        answer: 'On our dapp, we sponsor gasless claiming. Integrators can choose to sponsor the transactions. We do not have a fee on the protocol, see ',
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
                <div className="w-full bg-white py-8 text-center sm:px-6 lg:mx-0 lg:w-2/3 lg:max-w-none lg:px-0">
                    <h1 className="mx-auto mb-8 mt-0 w-3/4 text-5xl font-black">Send Tokens with a Link</h1>
                    <div className="m-4 mx-auto w-3/4 p-2 text-xl">
                        Go viral with claim links. Let your users send tokens through links
                    </div>

                    <div className="mt-8 flex justify-center space-x-4 p-2">
                        <a
                            data-cal-link="https://cal.com/kkonrad+hugo/dynamic?duration=15"
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
                            className="p-5 text-2xl font-black text-black hover:underline"
                        >
                            Integrate →
                        </a>
                    </div>

                    <div className="m-5 mt-12 flex flex-row flex-wrap items-center justify-center gap-8 gap-y-8">
                        {logoCloudLogos.map((logo) => {
                            return (
                                <img
                                    key={logo.src}
                                    className="h-12 object-contain grayscale"
                                    src={logo.src}
                                    alt="Transistor"
                                    loading="eager"
                                />
                            )
                        })}
                    </div>
                </div>

                <div className="center-xy brutalborder-x z-index-1 relative hidden w-1/3 items-center justify-center overflow-hidden bg-fuchsia py-3 lg:flex lg:pb-16  lg:pt-32 ">
                    <img
                        src={peanutman_happy.src}
                        className="absolute  duration-200 hover:rotate-12"
                        alt="Peanutman Cheering"
                    />
                </div>
            </div>

            {/* seperator */}
            <div className="brutalborder-y">
                <global_components.MarqueeWrapper backgroundColor="bg-white">
                    {Object.entries(chain_logos).map(([chain, logo]) => {
                        return (
                            <div className="pb-5 pl-3 pt-5" key={chain}>
                                <img src={logo.default.src} className="h-16 w-16" />
                            </div>
                        )
                    })}
                </global_components.MarqueeWrapper>
            </div>

            {/* how it works */}
            <div className=" flex flex-col gap-4 bg-white p-4">
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
                        <h1 className="mx-auto my-0 w-3/4  pt-4 text-5xl font-black">Go viral</h1>
                        <div className="mx-auto w-3/4 pb-4 text-xl ">
                            Links are the easiest way to send crypto. Leverage your userbase to get more users. Let your
                            users send tokens to their friends and get them onboarded, no matter whether they’re users
                            already.
                        </div>

                        <div className="mt-8 flex justify-center space-x-4 p-2">
                            <a
                                data-cal-link="kkonrad/15min"
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
                                className="p-5 text-2xl font-black text-black hover:underline"
                            >
                                Integrate →
                            </a>
                        </div>
                    </div>
                </div>
                <div className="brutalborder flex flex-col items-center justify-center gap-6 border-2 border-black bg-fuchsia py-8 text-black sm:py-16 lg:flex-row-reverse">
                    {/* right column */}
                    <div className=" relative flex items-center justify-center px-8 lg:h-1/3 lg:w-1/3   ">
                        <a href="https://docs.peanut.to/overview/wallet-integrations/figma-flow" target="_blank">
                            <img
                                src={teal_wallet_two.src}
                                className="brutalborder brutalshadow mx-2 h-full w-64 object-cover sm:w-full"
                                alt="Peanutman Cheering"
                            />
                        </a>
                    </div>
                    {/* left column */}
                    <div className=" flex w-full flex-col gap-2 text-center sm:gap-8 sm:px-6 lg:mx-0 lg:w-2/3 lg:max-w-none lg:px-0">
                        <h1 className="mx-auto my-0 w-3/4  pt-4 text-5xl font-black">Claim gasless</h1>
                        <div className="mx-auto w-3/4 pb-4 text-xl ">
                            Onboard new users seamlessly with a gassless claiming and onboarding experience.
                        </div>

                        <div className="mt-8 flex justify-center space-x-4 p-2">
                            <a
                                data-cal-link="kkonrad/15min"
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
                                className="p-5 text-2xl font-black text-black hover:underline"
                            >
                                Integrate →
                            </a>
                        </div>
                    </div>
                </div>
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
                                            <a data-cal-link="kkonrad/15min" data-cal-config='{"layout":"month_view"}'>
                                                Let's talk!
                                            </a>
                                        </button>
                                    )}
                                    {feature.primaryRedirectUrl ? (
                                        feature.calModal ? (
                                            <a
                                                href={feature.primaryRedirectUrl}
                                                target="_blank"
                                                className="p-5 text-2xl font-black text-black hover:underline"
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
                                            className="p-5 text-2xl font-black text-black "
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
                <div className="flex flex-col gap-0">
                    {faqs.map((faq, idx) => (
                        <div
                            className={classNames(
                                'brutalborder-left brutalborder-top brutalborder-right cursor-pointer rounded-none bg-white text-black ',
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
                                    ' flex w-full flex-row items-center justify-between border-none bg-white  text-2xl '
                                )}
                            >
                                <label className="px-8 py-4">{faq.question}</label>
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
                                                data-cal-link="kkonrad/15min"
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
            <global_components.MarqueeWrapper backgroundColor="bg-black">
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
        </div>
    )
}
