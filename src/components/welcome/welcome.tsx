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
import { useState } from 'react'

const logoCloudLogos = [beam_logo, eco_logo, kofime_logo, hypersphere_logo, zeeprime_logo, wallet_connect_logo]
const features = [
    {
        name: 'white-labled',
        description:
            'Customize token and claim page to match your branding with logo and colors. Or even better, have the users claim the tokens on your own domain or app!',
        bg: 'bg-yellow',
    },
    {
        name: 'gasless',
        description:
            'Customize token and claim page to match your branding with logo and colors. Or even better, have the users claim the tokens on your own domain or app!',
        bg: 'bg-fuchsia',
    },
    {
        name: 'campaigns',
        description:
            'Customize token and claim page to match your branding with logo and colors. Or even better, have the users claim the tokens on your own domain or app!',
        bg: 'bg-red',
    },
    {
        name: 'xchain',
        description:
            'Customize token and claim page to match your branding with logo and colors. Or even better, have the users claim the tokens on your own domain or app!',
        bg: 'bg-lightblue',
    },
    {
        name: 'physical',
        description:
            'Customize token and claim page to match your branding with logo and colors. Or even better, have the users claim the tokens on your own domain or app!',
        bg: 'bg-teal',
    },
    {
        name: 'NFTs',
        description:
            'Customize token and claim page to match your branding with logo and colors. Or even better, have the users claim the tokens on your own domain or app!',
        bg: 'bg-yellow',
    },
]
const faqs = [
    { question: 'How does it work?', answer: 'It just does.' },
    { question: 'How does it work?', answer: 'It just does.' },
    { question: 'How does it work?', answer: 'It just does.' },
    { question: 'How does it work?', answer: 'It just does.' },
]
const testimonials = [
    {
        imageSrc: orest_image.src,
        altText: 'picture of bearded man',
        comment: 'How did this not exist before?! Great UX!',
        name: 'Orest Tarasiuk',
        detail: 'Scroll.io',
        bgColorClass: 'bg-yellow',
    },
    {
        imageSrc: mydas_image.src,
        altText: 'picture of rasta NFT',
        comment: 'Love this! Will help in mass crypto adoption.',
        name: 'Mydas.eth',
        detail: 'University of Nicosia',
        bgColorClass: 'bg-fuchsia',
    },
    {
        imageSrc: steven_image.src,
        altText: 'picture of smiling man',
        comment: 'Very buttery experience!',
        name: 'Steven Robinson',
        detail: 'Arkn Ventures',
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

    return (
        <div className="mt-0 flex h-full min-h-[100vh] flex-col  ">
            {/* hero */}
            <div className="flex border-2 border-black bg-white text-black">
                <div className="w-full bg-white py-8 text-center sm:px-6 lg:mx-0 lg:w-2/3 lg:max-w-none lg:px-0">
                    <h1 className="mx-auto mb-8 mt-0 w-3/4 text-5xl font-black">Send Tokens with a Link</h1>
                    <div className="m-4 mx-auto w-3/4 p-2 text-xl">
                        Forget chains and wallet addresses. Send tokens with a trustless payment link, no matter whether
                        the recipient has a wallet.
                    </div>

                    <div className="mt-8 flex justify-center space-x-4 p-2">
                        <a
                            href="https://cal.com/kkonrad"
                            target="_blank"
                            id="cta-btn"
                            className="mb-2 block bg-white p-5 text-2xl font-black md:w-3/5 lg:w-1/3"
                        >
                            cal.com
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
                            Forget chains and wallet addresses. Send tokens with a trustless payment link, no matter
                            whether the recipient has a wallet.Forget chains and wallet addresses. Send tokens with a
                            trustless payment link, no matter whether the recipient has a wallet.
                        </div>

                        <div className="flex justify-center space-x-4 p-2">
                            <a
                                href="/send"
                                id="cta-btn"
                                className="mb-2 block bg-white p-5 text-2xl font-black md:w-3/5 lg:w-1/3"
                            >
                                Try Now
                            </a>
                        </div>
                    </div>
                </div>
                <div className="brutalborder flex flex-col items-center justify-center gap-6 border-2 border-black bg-red py-8 text-black sm:py-16 lg:flex-row-reverse">
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
                            Forget chains and wallet addresses. Send tokens with a trustless payment link, no matter
                            whether the recipient has a wallet.Forget chains and wallet addresses. Send tokens with a
                            trustless payment link, no matter whether the recipient has a wallet.
                        </div>

                        <div className="flex justify-center space-x-4 p-2">
                            <a
                                href="/send"
                                id="cta-btn"
                                className="mb-2 block bg-white p-5 text-2xl font-black md:w-3/5 lg:w-1/3"
                            >
                                Try Now
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            {/* features */}
            <section className="lg:divide-y" id="features">
                <div className="brutalborder-y grid grid-cols-1 gap-2 overflow-hidden bg-white p-4 text-black sm:mx-0 sm:grid-cols-2 md:grid-cols-3">
                    {features.map((feature, index) => {
                        return (
                            <div
                                className={classNames(
                                    'brutalborder flex flex-col items-center justify-center p-4 ',
                                    feature.bg
                                )}
                                key={index}
                            >
                                <h2 className="mb-0 mt-0 flex h-12 items-center justify-center text-3xl">
                                    {feature.name}
                                </h2>
                                <p className="text-normal">{feature.description}</p>
                            </div>
                        )
                    })}
                </div>
            </section>

            {/* faq */}
            <div className="flex flex-col gap-4 px-4 py-4 text-black">
                <h2 className="my-0 px-4 font-bold">FAQ</h2>
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
                                <label className="p-4">{faq.question}</label>
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
                                <div className={classNames(' m-0 px-4 py-2 ')}>
                                    <p>{faq.answer}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* testimonials */}

            <section id="testimonials" className=" brutalborder-y justify-center bg-white p-4 text-black ">
                <div role="list" className="grid:cols-1 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
                                className="rainbow-border mx-auto w-1/2 rounded-none bg-white p-1"
                            />
                            <h1 className="mx-auto mt-2 py-2 text-base font-normal italic lg:text-lg">
                                {testimonial.comment}
                            </h1>
                            <p className="mb-4 text-base font-black uppercase">
                                {testimonial.name}
                                <span className="text-xs font-normal">
                                    {' '}
                                    <br /> {testimonial.detail}{' '}
                                </span>
                            </p>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    )
}
