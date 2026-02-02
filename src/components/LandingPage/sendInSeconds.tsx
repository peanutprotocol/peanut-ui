import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import borderCloud from '@/assets/illustrations/border-cloud.svg'
import exclamations from '@/assets/illustrations/exclamations.svg'
import payZeroFees from '@/assets/illustrations/pay-zero-fees.svg'
import mobileSendInSeconds from '@/assets/illustrations/mobile-send-in-seconds.svg'
import { Star, Sparkle } from '@/assets'
import { Button } from '@/components/0_Bruddle/Button'

export function SendInSeconds() {
    const [screenWidth, setScreenWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)

    useEffect(() => {
        const handleResize = () => {
            setScreenWidth(window.innerWidth)
        }

        handleResize()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    const createCloudAnimation = (side: 'left' | 'right', width: number, speed: number) => {
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

    // Button helper functions adapted from hero.tsx
    const getInitialAnimation = () => ({
        opacity: 0,
        translateY: 4,
        translateX: 0,
        rotate: 0.75,
    })

    const getAnimateAnimation = (buttonVisible: boolean, buttonScale: number = 1) => ({
        opacity: buttonVisible ? 1 : 0,
        translateY: buttonVisible ? 0 : 20,
        translateX: buttonVisible ? 0 : 20,
        rotate: buttonVisible ? 0 : 1,
        scale: buttonScale,
        pointerEvents: buttonVisible ? ('auto' as const) : ('none' as const),
    })

    const getHoverAnimation = () => ({
        translateY: 6,
        translateX: 0,
        rotate: 0.75,
    })

    const transitionConfig = { type: 'spring', damping: 15 } as const

    const getButtonClasses = () =>
        `btn bg-white fill-n-1 text-n-1 hover:bg-white/90 px-9 md:px-11 py-4 md:py-10 text-lg md:text-2xl btn-shadow-primary-4`

    const renderSparkle = () => (
        <img
            src={Sparkle.src}
            className="absolute -right-4 -top-4 h-auto w-5 sm:-right-5 sm:-top-5 sm:w-6"
            alt="Sparkle"
        />
    )

    return (
        <section id="send-in-seconds" className="relative overflow-hidden bg-secondary-1 px-4 py-16 text-n-1 md:py-32">
            {/* Decorative clouds, stars, and exclamations */}
            <div className="absolute left-0 top-0 h-full w-full overflow-hidden">
                {/* Animated clouds */}
                <motion.img
                    src={borderCloud.src}
                    alt="Floating Border Cloud"
                    className="absolute left-0"
                    style={{ top: '15%', width: 320 }}
                    {...createCloudAnimation('left', 320, 35)}
                />
                <motion.img
                    src={borderCloud.src}
                    alt="Floating Border Cloud"
                    className="absolute right-0"
                    style={{ top: '40%', width: 200 }}
                    {...createCloudAnimation('right', 200, 40)}
                />
                <motion.img
                    src={borderCloud.src}
                    alt="Floating Border Cloud"
                    className="absolute left-0"
                    style={{ top: '70%', width: 180 }}
                    {...createCloudAnimation('left', 180, 45)}
                />
                <motion.img
                    src={borderCloud.src}
                    alt="Floating Border Cloud"
                    className="absolute right-0"
                    style={{ top: '80%', width: 320 }}
                    {...createCloudAnimation('right', 320, 30)}
                />
            </div>

            {/* Animated stars and exclamations */}
            <motion.img
                src={Star.src}
                alt="Floating Star"
                width={50}
                height={50}
                className="absolute right-10 top-10 md:right-1/4 md:top-20"
                initial={{ opacity: 0, translateY: 20, translateX: 5, rotate: 45 }}
                whileInView={{ opacity: 1, translateY: 0, translateX: 0, rotate: 45 }}
                transition={{ type: 'spring', damping: 5, delay: 0.2 }}
            />
            <motion.img
                src={Star.src}
                alt="Floating Star"
                width={40}
                height={40}
                className="absolute bottom-16 left-1/3"
                initial={{ opacity: 0, translateY: 25, translateX: -5, rotate: -10 }}
                whileInView={{ opacity: 1, translateY: 0, translateX: 0, rotate: -10 }}
                transition={{ type: 'spring', damping: 5, delay: 0.4 }}
            />
            <motion.img
                src={Star.src}
                alt="Floating Star"
                width={50}
                height={50}
                className="absolute bottom-20 left-[2rem] md:bottom-72 md:right-[14rem]"
                initial={{ opacity: 0, translateY: 18, translateX: 5, rotate: -22 }}
                whileInView={{ opacity: 1, translateY: 0, translateX: 0, rotate: -22 }}
                transition={{ type: 'spring', damping: 5, delay: 0.6 }}
            />
            <motion.img
                src={Star.src}
                alt="Floating Star"
                width={60}
                height={60}
                className="absolute left-[20rem] top-72"
                initial={{ opacity: 0, translateY: 22, translateX: -5, rotate: 12 }}
                whileInView={{ opacity: 1, translateY: 0, translateX: 0, rotate: 12 }}
                transition={{ type: 'spring', damping: 5, delay: 0.8 }}
            />

            {/* Exclamations */}
            <Image
                src={exclamations}
                alt="Exclamations"
                width={200}
                height={300}
                className="absolute right-72 top-1/3 hidden -translate-y-1/2 transform md:block"
            />

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
                        initial={getInitialAnimation()}
                        animate={getAnimateAnimation(true, 1)}
                        whileHover={getHoverAnimation()}
                        transition={transitionConfig}
                    >
                        <a href="/send">
                            <Button
                                shadowSize="4"
                                className="bg-white px-7 py-3 text-base font-extrabold hover:bg-white/90 md:px-9 md:py-8 md:text-xl"
                            >
                                SEND NOW
                            </Button>
                        </a>
                    </motion.div>
                </div>
            </div>
        </section>
    )
}
