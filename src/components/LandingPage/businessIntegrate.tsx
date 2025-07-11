import React from 'react'
import Image from 'next/image'
import { Star } from '@/assets'

// Define the background color as a constant
const businessBgColor = '#90A8ED'

export function BusinessIntegrate() {
    return (
        <section 
            className="relative text-n-1 py-16 px-4 overflow-hidden"
            style={{ backgroundColor: businessBgColor }}
        >
            {/* Decorative scribble strokes - placeholders */}
            <div className="absolute top-8 left-1/2 transform -translate-x-1/2 w-[600px] h-[200px] bg-white/20 rounded-lg flex items-center justify-center">
                <span className="text-n-1 font-medium text-lg">Scribble Top Placeholder</span>
            </div>
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 w-[700px] h-[200px] bg-white/20 rounded-lg flex items-center justify-center">
                <span className="text-n-1 font-medium text-lg">Scribble Bottom Placeholder</span>
            </div>

            {/* Decorative stars */}
            <Image
                src={Star}
                alt="Star"
                width={50}
                height={50}
                className="absolute top-16 left-16"
                style={{ transform: 'rotate(25deg)' }}
            />
            <Image
                src={Star}
                alt="Star"
                width={40}
                height={40}
                className="absolute bottom-20 right-20"
                style={{ transform: 'rotate(-15deg)' }}
            />
            <Image
                src={Star}
                alt="Star"
                width={45}
                height={45}
                className="absolute top-32 right-32"
                style={{ transform: 'rotate(45deg)' }}
            />

            <div className="relative max-w-3xl mx-auto text-center">
                {/* Main heading */}
                <h2 className="text-3xl md:text-5xl font-roboto font-black mb-6" style={{ fontWeight: 900 }}>
                    PEANUT MEANS
                </h2>

                {/* Stylized BUSINESS title using knerd fonts */}
                <div className="mb-8">
                    <div className="relative inline-block">
                        <h1 className="relative font-knerd-filled text-white text-6xl md:text-8xl translate-x-[3px]" style={{ fontWeight: 300 }}>
                            BUSINESS
                        </h1>
                        <h1 className="absolute left-0 top-0 font-knerd-outline text-6xl md:text-8xl">
                            BUSINESS
                        </h1>
                    </div>
                </div>

                {/* Subtitle with scribble around a word */}
                <p className="text-lg md:text-xl font-roboto font-black mb-10" style={{ fontWeight: 900 }}>
                    PLUG-AND-PLAY MONEY RAILS FOR PRODUCTS THAT NEED TO{' '}
                    <span className="relative inline-block px-3 py-1">
                        MOVE
                        <Image
                            src="/scribble.svg"
                            alt="Scribble"
                            width={120}
                            height={40}
                            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                        />
                    </span>{' '}
                    FAST.
                </p>

                {/* CTA Button */}
                <button className="bg-white text-n-1 font-roboto font-black py-3 px-8 border-2 border-n-1 rounded-md hover:bg-grey-2 focus:outline-none" style={{ fontWeight: 900 }}>
                    INTEGRATE PEANUT
                </button>
            </div>
        </section>
    )
}