'use client'
import { useEffect } from 'react'

import * as global_components from '@/components/global'
import * as hooks from '@/hooks'

import smiley from '@/assets/smiley.svg'
import peanutman_happy from '@/assets/peanutman-happy.svg'

export default function ExperimentalPage() {
    const gaEventTracker = hooks.useAnalyticsEventTracker('experimental-page')

    useEffect(() => {
        gaEventTracker('peanut-opened', 'experimental')
    }, [])
    return (
        <global_components.PageWrapper showMarquee={false} bgColor="bg-lightblue">
            

            <div className="mt-0 flex h-full min-h-[100vh] flex-col  ">
            {/* Hero in columns */}
            <section className="text-black  lg:divide-y" id="hero">
                <div className="relative mx-auto">
                    <div className="border-2 border-black lg:grid lg:grid-flow-col-dense lg:grid-cols-2 ">
                        {/* left column */}
                        <div className="center-xy brutalborder relative overflow-hidden  bg-fuchsia py-3 lg:border-l-0 lg:pb-16 lg:pt-32">
                            <img
                                src={peanutman_happy.src}
                                className="absolute top-10 duration-200 hover:rotate-12"
                                alt="Peanutman Cheering"
                            />
                        </div>

                        {/* right column */}
                        <div className="brutalborder bg-white py-16 text-center sm:px-6 lg:mx-0 lg:max-w-none lg:px-0">
                            <h1 className="mx-auto my-8 w-3/4 text-5xl font-black">Experimental cross-chain</h1>
                            <div className="m-4 mx-auto w-3/4 p-2 text-xl">
                                This is an experimental feature where you can claim Peanut link on your preferred chain and in your preferred token. This is pre-release, we'd love to work together with you to make this awesome. 
                            </div>

                            <div className="mt-8 flex justify-center space-x-4 p-2">
                                <a
                                    href="/send"
                                    id="cta-btn"
                                    className="mb-2 block bg-white p-5 text-2xl font-black md:w-3/5 lg:w-1/3"
                                >
                                    Try Now
                                </a>

                                <a
                                    href="https://discord.gg/kVZqXDkrq7"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-5 text-2xl font-black text-black hover:underline"
                                >
                                    Share your ideas →
                                </a>
                            </div>
                        </div>

                    </div>
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



            {/* customise */}
            <section className="h-full w-full bg-white py-12 text-black">
                <div className="center-xy mx-auto flex w-11/12 items-center bg-white lg:w-3/5">
                    <div className="text-center">
                        <h2 className="title-font text-3xl font-black text-black lg:text-7xl">Thank you!</h2>

                        <div className="mx-auto w-4/5 p-5 text-xl lg:w-2/3">
                            Thanks for helping us! We're always keen on hearing new ideas or getting feedback. Maybe something did not work properly or you have an idea for an awesome integration. There is a small reward waiting for you. Let's chat about it!
                        </div>

                        <a href="https://discord.gg/kVZqXDkrq7" target="_blank" rel="noopener noreferrer">
                            <button id="cta-btn" className="cta m-10 bg-white px-3 text-2xl font-black hover:underline">
                                Join our community →
                            </button>
                        </a>
                    </div>
                </div>
            </section>

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


            {/*  */}
        </div>



        </global_components.PageWrapper>
    )
}
