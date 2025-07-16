import React from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import borderCloud from '@/assets/illustrations/border-cloud.svg'
import exclamations from '@/assets/illustrations/exclamations.svg'
import payZeroFees from '@/assets/illustrations/pay-zero-fees.svg'
import mobileSendInSeconds from '@/assets/illustrations/mobile-send-in-seconds.svg'
import { Star, Sparkle } from '@/assets'
import { useResizeHandler, createButtonAnimation, createStarAnimation, createCloudAnimation } from '@/hooks/useAnimations'

export function SendInSeconds() {
    const screenWidth = useResizeHandler()
    
    const buttonAnimation = createButtonAnimation(true, 1)
    
    const starAnimation1 = createStarAnimation(0.2)
    const starAnimation2 = createStarAnimation(0.4, 5, { translateY: 25, translateX: -5, rotate: -10 }, { rotate: -10 })
    const starAnimation3 = createStarAnimation(0.6, 5, { translateY: 18, translateX: 5, rotate: -22 }, { rotate: -22 })
    const starAnimation4 = createStarAnimation(0.8, 5, { translateY: 22, translateX: -5, rotate: 12 }, { rotate: 12 })
    
    const cloud1Animation = createCloudAnimation('left', 320, 35, screenWidth)
    const cloud2Animation = createCloudAnimation('right', 200, 40, screenWidth)
    const cloud3Animation = createCloudAnimation('left', 180, 45, screenWidth)
    const cloud4Animation = createCloudAnimation('right', 320, 30, screenWidth)

    const getButtonClasses = () =>
        `btn bg-white fill-n-1 text-n-1 hover:bg-white/90 px-9 md:px-11 py-4 md:py-10 text-lg md:text-2xl btn-shadow-primary-4`

    const renderSparkle = () => (
        <img
            src={Sparkle.src}
            className="absolute -right-4 -top-4 h-auto w-5 sm:-right-5 sm:-top-5 sm:w-6"
            alt="Sparkle"
        />
    )

    const renderArrows = () => (
        <>
            <Image
                src="/arrows/small-arrow.svg"
                alt="Arrow pointing to button"
                width={48}
                height={24}
                className="absolute -left-13 -top-7 block -translate-y-1/2 transform md:hidden"
            />
            <Image
                src="/arrows/small-arrow.svg"
                alt="Arrow pointing to button"
                width={48}
                height={24}
                className="absolute -right-13 -top-7 block -translate-y-1/2 scale-x-[-1] transform md:hidden"
            />
            <Image
                src="/arrows/small-arrow.svg"
                alt="Arrow pointing to button"
                width={64}
                height={32}
                className="absolute -left-18 -top-7 hidden -translate-y-1/2 transform md:block"
            />
            <Image
                src="/arrows/small-arrow.svg"
                alt="Arrow pointing to button"
                width={64}
                height={32}
                className="absolute -right-18 -top-7 hidden -translate-y-1/2 scale-x-[-1] transform md:block"
            />
        </>
    )

    return (
        <section className="relative overflow-hidden bg-secondary-1 px-4 py-16 text-n-1 md:py-32">
            {/* Decorative clouds, stars, and exclamations */}
            <div className="absolute left-0 top-0 h-full w-full overflow-hidden">
                {/* Animated clouds */}
                <motion.img
                    src={borderCloud.src}
                    alt="Floating Border Cloud"
                    className="absolute left-0"
                    style={{ top: '15%', width: 320 }}
                    {...cloud1Animation}
                />
                <motion.img
                    src={borderCloud.src}
                    alt="Floating Border Cloud"
                    className="absolute right-0"
                    style={{ top: '40%', width: 200 }}
                    {...cloud2Animation}
                />
                <motion.img
                    src={borderCloud.src}
                    alt="Floating Border Cloud"
                    className="absolute left-0"
                    style={{ top: '70%', width: 180 }}
                    {...cloud3Animation}
                />
                <motion.img
                    src={borderCloud.src}
                    alt="Floating Border Cloud"
                    className="absolute right-0"
                    style={{ top: '80%', width: 320 }}
                    {...cloud4Animation}
                />
            </div>

            {/* Animated stars and exclamations */}
            <motion.img
                src={Star.src}
                alt="Floating Star"
                width={50}
                height={50}
                className="absolute right-10 top-10 md:right-1/4 md:top-20"
                {...starAnimation1}
            />
            <motion.img
                src={Star.src}
                alt="Floating Star"
                width={40}
                height={40}
                className="absolute bottom-16 left-1/3"
                {...starAnimation2}
            />
            <motion.img
                src={Star.src}
                alt="Floating Star"
                width={50}
                height={50}
                className="absolute bottom-20 left-[2rem] md:bottom-72 md:right-[14rem]"
                {...starAnimation3}
            />
            <motion.img
                src={Star.src}
                alt="Floating Star"
                width={60}
                height={60}
                className="absolute left-[20rem] top-72"
                {...starAnimation4}
            />

            {/* Exclamations - only show on screens larger than 1780px */}
            {screenWidth > 1740 && (
                <Image
                    src={exclamations}
                    alt="Exclamations"
                    width={200}
                    height={300}
                    className="absolute right-72 top-1/3 -translate-y-1/2 transform"
                />
            )}

            {/* Main content */}
            <div className="relative mx-auto max-w-3xl text-center">
                <div className="mb-6 md:mb-10">
                    {/* Mobile version */}
                    <Image
                        src={mobileSendInSeconds}
                        alt="Send in Seconds. Pay Zero Fees. Start Right Now"
                        width={800}
                        height={200}
                        className="mx-auto block h-auto w-[90%] md:hidden"
                    />
                    {/* Desktop version */}
                    <Image
                        src={payZeroFees}
                        alt="Send in Seconds. Pay Zero Fees. Start Right Now"
                        width={800}
                        height={200}
                        className="mx-auto hidden h-auto w-full max-w-lg md:block md:max-w-4xl"
                    />
                </div>

                <p
                    className="mb-6 hidden font-roboto text-base font-medium leading-tight md:mb-8 md:block md:text-4xl"
                    style={{ fontWeight: 500, letterSpacing: '-0.5px' }}
                >
                    MOVE MONEY WORLDWIDE INSTANTLY.
                    <br />
                    ALWAYS UNDER YOUR CONTROL.
                </p>

                {/* Fixed CTA Button */}
                <div className="relative mt-12 inline-block md:mt-24">
                    <motion.div
                        className="relative"
                        initial={buttonAnimation.initial}
                        animate={buttonAnimation.animate}
                        whileHover={buttonAnimation.hover}
                        transition={buttonAnimation.transition}
                    >
                        <a href="/send" className={getButtonClasses()} style={{ fontWeight: 900 }}>
                            TRY NOW
                        </a>
                    </motion.div>

                    {renderArrows()}
                </div>
            </div>
        </section>
    )
}
