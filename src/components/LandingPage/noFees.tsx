import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import gotItHand from '@/assets/illustrations/got-it-hand.svg'
import gotItHandFlipped from '@/assets/illustrations/got-it-hand-flipped.svg'
import borderCloud from '@/assets/illustrations/border-cloud.svg'
import { Star } from '@/assets'
import scribble from '@/assets/scribble.svg'
import Image from 'next/image'

export function NoFees() {
    const [screenWidth, setScreenWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)

    useEffect(() => {
        const handleResize = () => {
            setScreenWidth(window.innerWidth)
        }

        handleResize()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    const createCloudAnimation = (side: 'left' | 'right', top: string, width: number, speed: number) => {
        const vpWidth = screenWidth || 1080
        const totalDistance = vpWidth + width

        return {
            initial: { x: side === 'left' ? -width : vpWidth },
            animate: { x: side === 'left' ? vpWidth : -width },
            transition: {
                ease: 'linear',
                duration: totalDistance / speed,
                repeat: Infinity,
            },
        }
    }

    return (
        <section className="relative overflow-hidden bg-secondary-3 px-4 py-16 md:py-32">
            <div className="absolute left-0 top-0 h-full w-full overflow-hidden">
                {/* Animated clouds */}
                <motion.img
                    src={borderCloud.src}
                    alt="Floating Border Cloud"
                    className="absolute left-0"
                    style={{ top: '20%', width: 200 }}
                    {...createCloudAnimation('left', '20%', 200, 35)}
                />
                <motion.img
                    src={borderCloud.src}
                    alt="Floating Border Cloud"
                    className="absolute right-0"
                    style={{ top: '60%', width: 220 }}
                    {...createCloudAnimation('right', '60%', 220, 40)}
                />
            </div>

            <div className="relative mx-auto max-w-3xl text-center">
                {/* Animated stars */}
                <motion.img
                    src={Star.src}
                    alt="Floating Star"
                    width={50}
                    height={50}
                    className="absolute -right-36 -top-12"
                    initial={{ opacity: 0, translateY: 20, translateX: 5, rotate: 22 }}
                    whileInView={{ opacity: 1, translateY: 0, translateX: 0, rotate: 22 }}
                    transition={{ type: 'spring', damping: 5, delay: 0.2 }}
                />
                <motion.img
                    src={Star.src}
                    alt="Floating Star"
                    width={50}
                    height={50}
                    className="absolute -right-58 top-30"
                    initial={{ opacity: 0, translateY: 28, translateX: -5, rotate: -17 }}
                    whileInView={{ opacity: 1, translateY: 0, translateX: 0, rotate: -17 }}
                    transition={{ type: 'spring', damping: 5, delay: 0.4 }}
                />
                <motion.img
                    src={Star.src}
                    alt="Floating Star"
                    width={50}
                    height={50}
                    className="absolute -right-0 top-58"
                    initial={{ opacity: 0, translateY: 20, translateX: 5, rotate: 22 }}
                    whileInView={{ opacity: 1, translateY: 0, translateX: 0, rotate: 22 }}
                    transition={{ type: 'spring', damping: 5, delay: 0.6 }}
                />
                <motion.img
                    src={Star.src}
                    alt="Floating Star"
                    width={50}
                    height={50}
                    className="absolute -left-36 -top-20"
                    initial={{ opacity: 0, translateY: 15, translateX: -5, rotate: -7 }}
                    whileInView={{ opacity: 1, translateY: 0, translateX: 0, rotate: -7 }}
                    transition={{ type: 'spring', damping: 5, delay: 0.8 }}
                />
                <motion.img
                    src={Star.src}
                    alt="Floating Star"
                    width={50}
                    height={50}
                    className="absolute -bottom-6 -left-10"
                    initial={{ opacity: 0, translateY: 25, translateX: -5, rotate: -5 }}
                    whileInView={{ opacity: 1, translateY: 0, translateX: 0, rotate: -5 }}
                    transition={{ type: 'spring', damping: 5, delay: 1.0 }}
                />
                {/* Main stylized headline */}
                <div className="mb-6 md:mb-8">
                    <div className="relative inline-block">
                        <h1 className="relative translate-x-[3px] font-knerd-filled text-4xl text-white md:text-8xl">
                            0 FEES
                        </h1>
                        <h1 className="absolute left-0 top-0 font-knerd-outline text-4xl md:text-8xl">0 FEES</h1>

                        {/* Bottom left arrow pointing to "0" */}
                        <Image
                            src="/arrows/bottom-left-arrow.svg"
                            alt="Bottom left arrow"
                            width={40}
                            height={40}
                            className="absolute -left-12 bottom-1 hidden md:-left-10 md:bottom-4 md:block md:h-[60px] md:w-[60px]"
                            style={{ transform: 'rotate(22deg)' }}
                        />

                        {/* Bottom right arrow pointing to "S" */}
                        <Image
                            src="/arrows/bottom-right-arrow.svg"
                            alt="Bottom right arrow"
                            width={40}
                            height={40}
                            className="absolute -right-12 bottom-1 hidden md:-right-12 md:bottom-6 md:block md:h-[60px] md:w-[60px]"
                            style={{ transform: 'rotate(62deg)' }}
                        />
                    </div>
                </div>

                {/* Subheading */}
                <h3 className="mb-4 font-roboto text-lg font-black text-n-1 md:text-3xl" style={{ fontWeight: 900 }}>
                    REALLY, WE MEAN{' '}
                    <span className="relative inline-block px-2 py-1 md:px-3">
                        ZERO
                        <Image
                            src={scribble}
                            alt="Scribble"
                            width={100}
                            height={35}
                            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 md:h-[50px] md:w-[140px]"
                        />
                    </span>
                </h3>

                {/* No hidden fees line with icons */}
                <div className="flex items-center justify-center space-x-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full md:h-10 md:w-10">
                        <Image src={gotItHand} alt="Got it hand" className="h-full w-full" />
                    </div>
                    <span className="font-roboto text-base font-black text-n-1 md:text-2xl" style={{ fontWeight: 900 }}>
                        NO HIDDEN FEES
                    </span>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full md:h-10 md:w-10">
                        <Image src={gotItHandFlipped} alt="Got it hand flipped" className="h-full w-full" />
                    </div>
                </div>
            </div>
        </section>
    )
}
