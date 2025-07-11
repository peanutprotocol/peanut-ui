import React from 'react'
import Image from 'next/image'
import { Star } from '@/assets'

// Define the background color as a constant
const businessBgColor = '#90A8ED'

export function BusinessIntegrate() {
    return (
        <section
            className="relative min-h-[900px] overflow-hidden px-4 py-16 text-n-1"
            style={{ backgroundColor: businessBgColor }}
        >
            <div className="relative mx-auto max-w-3xl text-center">
                {/* Main heading */}
                <h2
                    className="mb-24 mt-20 font-roboto text-3xl font-black md:text-[4.5rem]"
                    style={{ fontWeight: 900 }}
                >
                    PEANUT MEANS
                </h2>

                {/* Stylized BUSINESS title using knerd fonts */}
                <div className="mb-20">
                    <div className="relative inline-block">
                        <h1
                            className="relative translate-x-[3px] font-knerd-filled text-6xl text-white md:text-8xl"
                            style={{ fontWeight: 300 }}
                        >
                            BUSINESS
                        </h1>
                        <h1 className="absolute left-0 top-0 font-knerd-outline text-6xl md:text-8xl">BUSINESS</h1>
                        <Image
                            src="/scribble.svg"
                            alt="Scribble around BUSINESS"
                            width={1200}
                            height={120}
                            unoptimized
                            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-x-[-1.15] scale-y-[-0.9]"
                        />
                    </div>
                </div>

                {/* Subtitle with scribble around a word */}
                <p className="mb-16 font-roboto text-lg font-black md:text-4xl" style={{ fontWeight: 900 }}>
                    PLUG-AND-PLAY MONEY RAILS FOR PRODUCTS THAT NEED TO MOVE FAST.
                </p>

                {/* CTA Button */}
                <button
                    className="rounded-sm border-2 border-n-1 bg-white px-10 py-4 font-roboto text-lg font-black text-n-1 hover:bg-grey-2 focus:outline-none"
                    style={{ fontWeight: 900 }}
                >
                    INTEGRATE PEANUT
                </button>
            </div>
        </section>
    )
}
