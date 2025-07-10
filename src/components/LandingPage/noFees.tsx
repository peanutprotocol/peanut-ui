import React from 'react'
import gotItHand from '@/assets/illustrations/got-it-hand.svg'
import gotItHandFlipped from '@/assets/illustrations/got-it-hand-flipped.svg'
import { Cloud, Star } from '@/assets'
import Image from 'next/image'

export function NoFees() {
    return (
        <section className="relative overflow-hidden bg-secondary-3 px-4 py-32">
            <div className="relative mx-auto max-w-3xl text-center">
                {/* Decorative clouds and stars */}
                <Image
                    src={Cloud}
                    alt="Cloud"
                    width={200}
                    height={100}
                    className="absolute -left-48 -top-12"
                />
                <Image
                    src={Cloud}
                    alt="Cloud"
                    width={200}
                    height={100}
                    className="absolute -bottom-12 -right-48"
                />
                <Image
                    src={Star}
                    alt="Star"
                    width={50}
                    height={50}
                    className="absolute -top-6 right-1/3"
                />
                <Image
                    src={Star}
                    alt="Star"
                    width={50}
                    height={50}
                    className="absolute -bottom-6 left-1/3"
                />
                {/* Main stylized headline */}
                <div className="mb-8">
                    <div className="relative inline-block">
                        <h1 className="relative translate-x-[3px] font-knerd-filled text-6xl text-white md:text-8xl">
                            0 FEES
                        </h1>
                        <h1 className="absolute left-0 top-0 font-knerd-outline text-6xl md:text-8xl">0 FEES</h1>
                    </div>
                </div>

                {/* Subheading */}
                <h3 className="mb-4 font-roboto text-2xl font-black text-n-1 md:text-3xl" style={{ fontWeight: 900 }}>
                    REALLY, WE MEAN ZERO
                </h3>

                {/* No hidden fees line with icons */}
                <div className="flex items-center justify-center space-x-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full">
                        <Image src={gotItHand} alt="Got it hand" className="h-full w-full" />
                    </div>
                    <span className="font-roboto text-xl font-black text-n-1 md:text-2xl" style={{ fontWeight: 900 }}>
                        NO HIDDEN FEES
                    </span>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full">
                        <Image src={gotItHandFlipped} alt="Got it hand flipped" className="h-full w-full" />
                    </div>
                </div>
            </div>
        </section>
    )
}
