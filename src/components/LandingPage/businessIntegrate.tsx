import React from 'react'
import Image from 'next/image'
import scribble from '@/assets/scribble.svg'
import { Button } from '../0_Bruddle'

// Define the background color as a constant
const businessBgColor = '#90A8ED'

export function BusinessIntegrate() {
    return (
        <section
            className="relative min-h-[500px] overflow-hidden px-4 py-16 text-n-1 md:min-h-[900px]"
            style={{ backgroundColor: businessBgColor }}
        >
            <div className="relative mx-auto max-w-3xl text-center">
                {/* Main heading */}
                <div className="mb-8 mt-8 md:mb-24 md:mt-20">
                    <h1 className="font-roboto-flex-extrabold font-extraBlack lg:text-headingMedium md:text-heading text-5xl">
                        PEANUT MEANS
                    </h1>
                </div>

                {/* Stylized BUSINESS title using knerd fonts */}
                <div className="mb-8 md:mb-20">
                    <div className="relative inline-block">
                        <h1
                            className="relative translate-x-[2px] font-knerd-filled text-[4rem] text-white md:translate-x-[3px] md:text-8xl"
                            style={{ fontWeight: 300 }}
                        >
                            BUSINESS
                        </h1>
                        <h1 className="absolute left-0 top-0 font-knerd-outline text-[4rem] md:text-8xl">BUSINESS</h1>
                        <Image
                            src={scribble}
                            alt="Scribble around BUSINESS"
                            width={1200}
                            height={120}
                            unoptimized
                            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-x-[-1.1] scale-y-[-1.0] md:scale-x-[-1.15] md:scale-y-[-0.9]"
                        />
                    </div>
                </div>

                {/* Subtitle with scribble around a word */}
                <p
                    className="mb-8 max-w-xs font-roboto text-xl font-medium leading-tight md:mb-16 md:max-w-none md:text-4xl"
                    style={{ fontWeight: 500, letterSpacing: '-0.5px' }}
                >
                    PLUG-AND-PLAY MONEY RAILS <br /> FOR PRODUCTS THAT NEED TO MOVE FAST.
                </p>

                {/* CTA Button */}
                <a
                    href="https://peanutprotocol.notion.site/12c83811757980afb3b6d3e5a4c68f4d"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <Button
                        shadowSize="4"
                        className="inline-block w-58 bg-white px-7 pb-11 pt-4 text-base font-extrabold hover:bg-white/90 md:w-72 md:px-10 md:text-lg"
                    >
                        INTEGRATE PEANUT
                    </Button>
                </a>
            </div>
        </section>
    )
}
