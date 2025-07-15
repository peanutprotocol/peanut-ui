import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import gotItHand from '@/assets/illustrations/got-it-hand.svg'
import gotItHandFlipped from '@/assets/illustrations/got-it-hand-flipped.svg'
import borderCloud from '@/assets/illustrations/border-cloud.svg'
import zero from '@/assets/illustrations/zero.svg'
import mobileZeroFees from '@/assets/illustrations/mobile-zero-fees.svg'
import noHiddenFees from '@/assets/illustrations/no-hidden-fees.svg'
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
                <div className="mb-4">
                    {/* Mobile version */}
                    <div className="block md:hidden">
                        <Image
                            src={mobileZeroFees}
                            alt="0 FEES"
                            width={400}
                            height={100}
                            className="mx-auto h-auto w-[95%]"
                        />
                    </div>
                    
                    {/* Desktop version */}
                    <div className="relative hidden md:inline-block md:mb-5">
                        <div className="flex items-baseline justify-center">
                            <Image
                                src={zero}
                                alt="Zero"
                                width={60}
                                height={60}
                                className="mr-2 h-[27px] w-[27px] md:mr-6 md:h-[160px] md:w-[160px]"
                            />
                            <div className="relative">
                                <h1 className="relative translate-x-[1px] font-knerd-filled text-4xl text-white md:translate-x-[3px] md:text-[13rem]">
                                    FEES
                                </h1>
                                <h1 className="absolute left-0 top-0 font-knerd-outline text-4xl md:text-[13rem]">FEES</h1>
                            </div>
                        </div>

                        {/* Bottom left arrow pointing to zero */}
                        <Image
                            src="/arrows/bottom-left-arrow.svg"
                            alt="Bottom left arrow"
                            width={40}
                            height={100}
                            className="absolute -left-12 bottom-1 hidden md:-left-12 md:-bottom-5 md:block md:h-[120px] md:w-[120px]"
                            style={{ transform: 'rotate(25deg)' }}
                        />

                        {/* Bottom right arrow pointing to "S" in FEES */}
                        <Image
                            src="/arrows/bottom-right-arrow.svg"
                            alt="Bottom right arrow"
                            width={40}
                            height={100}
                            className="absolute -right-12 bottom-1 hidden md:-right-19 md:-bottom-3 md:block md:h-[120px] md:w-[120px]"
                            style={{ transform: 'rotate(48deg)' }}
                        />
                    </div>
                </div>

                {/* No hidden fees SVG */}
                <div className="mb-1">
                    <Image
                        src={noHiddenFees}
                        alt="Really, we mean zero. No hidden fees"
                        width={600}
                        height={150}
                        className="mx-auto h-auto w-full max-w-xs md:max-w-md"
                    />
                </div>
            </div>
        </section>
    )
}
