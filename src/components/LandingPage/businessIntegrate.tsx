import React from 'react'
import Image from 'next/image'
import { Star } from '@/assets'
import scribble from '@/assets/scribble.svg'
import peanutMeans from '@/assets/illustrations/peanut-means.svg'

// Define the background color as a constant
const businessBgColor = '#90A8ED'

export function BusinessIntegrate() {
    return (
        <section
            className="relative min-h-[600px] overflow-hidden px-4 py-16 text-n-1 md:min-h-[900px]"
            style={{ backgroundColor: businessBgColor }}
        >
            <div className="relative mx-auto max-w-3xl text-center">
                {/* Main heading */}
                <div className="mb-12 mt-8 md:mb-24 md:mt-20">
                    <Image
                        src={peanutMeans}
                        alt="Peanut Means"
                        width={600}
                        height={120}
                        className="mx-auto h-auto w-full max-w-md md:max-w-2xl"
                    />
                </div>

                {/* Stylized BUSINESS title using knerd fonts */}
                <div className="mb-12 md:mb-20">
                    <div className="relative inline-block">
                        <h1
                            className="relative translate-x-[2px] font-knerd-filled text-4xl text-white md:translate-x-[3px] md:text-8xl"
                            style={{ fontWeight: 300 }}
                        >
                            BUSINESS
                        </h1>
                        <h1 className="absolute left-0 top-0 font-knerd-outline text-4xl md:text-8xl">BUSINESS</h1>
                        <Image
                            src={scribble}
                            alt="Scribble around BUSINESS"
                            width={1200}
                            height={120}
                            unoptimized
                            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-x-[-1.15] scale-y-[-0.9]"
                        />
                    </div>
                </div>

                {/* Subtitle with scribble around a word */}
                <p
                    className="mb-12 font-roboto text-base font-medium leading-tight md:mb-16 md:text-4xl"
                    style={{ fontWeight: 500, letterSpacing: '-0.5px' }}
                >
                    PLUG-AND-PLAY MONEY RAILS <br/> FOR PRODUCTS THAT NEED TO MOVE FAST.
                </p>

                {/* CTA Button */}
                <a
                    href="https://peanutprotocol.notion.site/12c83811757980afb3b6d3e5a4c68f4d"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block rounded-sm border-2 border-n-1 bg-white px-8 py-3 font-roboto text-base font-black text-n-1 hover:bg-grey-2 focus:outline-none md:px-10 md:py-4 md:text-lg"
                    style={{ fontWeight: 900, boxShadow: '4px 4px 0 #000' }}
                >
                    INTEGRATE PEANUT
                </a>
            </div>
        </section>
    )
}
