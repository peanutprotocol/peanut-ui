import React from 'react'
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
import { useResizeHandler, createStarAnimation, createCloudAnimation } from '@/hooks/useAnimations'

export function NoFees() {
    const screenWidth = useResizeHandler()

    const starAnimation1 = createStarAnimation(0.2, 5, { rotate: 22 }, { rotate: 22 })
    const starAnimation2 = createStarAnimation(0.4, 5, { translateY: 28, translateX: -5, rotate: -17 }, { rotate: -17 })
    const starAnimation3 = createStarAnimation(0.6, 5, { rotate: 22 }, { rotate: 22 })
    const starAnimation4 = createStarAnimation(0.8, 5, { translateY: 15, translateX: -5, rotate: -7 }, { rotate: -7 })
    const starAnimation5 = createStarAnimation(1.0, 5, { translateY: 25, translateX: -5, rotate: -5 }, { rotate: -5 })

    const cloud1Animation = createCloudAnimation('left', 200, 35, screenWidth)
    const cloud2Animation = createCloudAnimation('right', 220, 40, screenWidth)

    return (
        <section className="relative overflow-hidden bg-secondary-3 px-4 py-24 md:py-40">
            <div className="absolute left-0 top-0 h-full w-full overflow-hidden">
                {/* Animated clouds */}
                <motion.img
                    src={borderCloud.src}
                    alt="Floating Border Cloud"
                    className="absolute left-0"
                    style={{ top: '20%', width: 200 }}
                    {...cloud1Animation}
                />
                <motion.img
                    src={borderCloud.src}
                    alt="Floating Border Cloud"
                    className="absolute right-0"
                    style={{ top: '60%', width: 220 }}
                    {...cloud2Animation}
                />
            </div>

            <div className="relative mx-auto max-w-3xl text-center">
                {/* Animated stars */}
                <motion.img
                    src={Star.src}
                    alt="Floating Star"
                    className="absolute -right-36 -top-12 w-8 md:w-12"
                    {...starAnimation1}
                />
                <motion.img
                    src={Star.src}
                    alt="Floating Star"
                    className="absolute -right-58 top-30 w-8 md:w-12"
                    {...starAnimation2}
                />
                <motion.img
                    src={Star.src}
                    alt="Floating Star"
                    className="absolute -right-0 -top-16 w-8 md:top-58 md:w-12"
                    {...starAnimation3}
                />
                <motion.img
                    src={Star.src}
                    alt="Floating Star"
                    className="absolute -left-36 -top-20 w-8 md:w-12"
                    {...starAnimation4}
                />
                <motion.img
                    src={Star.src}
                    alt="Floating Star"
                    className="absolute -bottom-6 -left-10 w-8 md:w-12"
                    {...starAnimation5}
                />
                {/* Main stylized headline */}
                <div className="md:mb-4">
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
                    <div className="relative hidden md:mb-5 md:inline-block">
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
                                <h1 className="absolute left-0 top-0 font-knerd-outline text-4xl md:text-[13rem]">
                                    FEES
                                </h1>
                            </div>
                        </div>

                        {/* Bottom left arrow pointing to zero */}
                        <Image
                            src="/arrows/bottom-left-arrow.svg"
                            alt="Bottom left arrow"
                            width={40}
                            height={100}
                            className="absolute -left-12 bottom-1 hidden md:-bottom-5 md:-left-12 md:block md:h-[120px] md:w-[120px]"
                            style={{ transform: 'rotate(25deg)' }}
                        />

                        {/* Bottom right arrow pointing to "S" in FEES */}
                        <Image
                            src="/arrows/bottom-right-arrow.svg"
                            alt="Bottom right arrow"
                            width={40}
                            height={100}
                            className="absolute -right-12 bottom-1 hidden md:-bottom-3 md:-right-19 md:block md:h-[120px] md:w-[120px]"
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
