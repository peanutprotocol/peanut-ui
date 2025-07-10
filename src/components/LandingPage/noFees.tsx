import React from 'react'
import gotItHand from '@/assets/illustrations/got-it-hand.svg'
import gotItHandFlipped from '@/assets/illustrations/got-it-hand-flipped.svg'
import borderCloud from '@/assets/illustrations/border-cloud.svg'
import { Star } from '@/assets'
import Image from 'next/image'

export function NoFees() {
    return (
        <section className="relative overflow-hidden bg-secondary-3 px-4 py-32">
            <div className="relative mx-auto max-w-3xl text-center">
                {/* Decorative clouds and stars */}
                <Image src={borderCloud} alt="Border Cloud" width={200} height={100} className="absolute -left-48" />
                <Image
                    src={borderCloud}
                    alt="Border Cloud"
                    width={200}
                    height={100}
                    className="absolute -bottom-12 -right-64"
                />
                <Image
                    src={Star}
                    alt="Star"
                    width={50}
                    height={50}
                    className="absolute -right-36 -top-12"
                    style={{ transform: 'rotate(22deg)' }}
                />
                <Image
                    src={Star}
                    alt="Star"
                    width={50}
                    height={50}
                    className="absolute -right-58 top-30"
                    style={{ transform: 'rotate(-17deg)' }}
                />
                <Image
                    src={Star}
                    alt="Star"
                    width={50}
                    height={50}
                    className="absolute -right-0 top-58"
                    style={{ transform: 'rotate(22deg)' }}
                />
                <Image
                    src={Star}
                    alt="Star"
                    width={50}
                    height={50}
                    className="absolute -left-36 -top-20"
                    style={{ transform: 'rotate(-7deg)' }}
                />
                <Image
                    src={Star}
                    alt="Star"
                    width={50}
                    height={50}
                    className="absolute -bottom-6 -left-10"
                    style={{ transform: 'rotate(-5deg)' }}
                />
                {/* Main stylized headline */}
                <div className="mb-8">
                    <div className="relative inline-block">
                        <h1 className="relative translate-x-[3px] font-knerd-filled text-6xl text-white md:text-8xl">
                            0 FEES
                        </h1>
                        <h1 className="absolute left-0 top-0 font-knerd-outline text-6xl md:text-8xl">0 FEES</h1>

                        {/* Bottom left arrow pointing to "0" */}
                        <Image
                            src="/arrows/bottom-left-arrow.svg"
                            alt="Bottom left arrow"
                            width={60}
                            height={60}
                            className="absolute -left-16 bottom-2 md:-left-10 md:bottom-4"
                            style={{ transform: 'rotate(22deg)' }}
                        />

                        {/* Bottom right arrow pointing to "S" */}
                        <Image
                            src="/arrows/bottom-right-arrow.svg"
                            alt="Bottom right arrow"
                            width={60}
                            height={60}
                            className="absolute -right-16 bottom-2 md:-right-12 md:bottom-6"
                            style={{ transform: 'rotate(62deg)' }}
                        />
                    </div>
                </div>

                {/* Subheading */}
                <h3 className="mb-4 font-roboto text-2xl font-black text-n-1 md:text-3xl" style={{ fontWeight: 900 }}>
                    REALLY, WE MEAN{' '}
                    <span className="relative inline-block px-3 py-1">
                        ZERO
                        <Image
                            src="/scribble.svg"
                            alt="Scribble"
                            width={140}
                            height={50}
                            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                        />
                    </span>
                </h3>

                {/* No hidden fees line with icons */}
                <div className="flex items-center justify-center space-x-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full">
                        <Image src={gotItHand} alt="Got it hand" className="h-full w-full" />
                    </div>
                    <span className="font-roboto text-xl font-black text-n-1 md:text-2xl" style={{ fontWeight: 900 }}>
                        NO HIDDEN FEES
                    </span>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full">
                        <Image src={gotItHandFlipped} alt="Got it hand flipped" className="h-full w-full" />
                    </div>
                </div>
            </div>
        </section>
    )
}
