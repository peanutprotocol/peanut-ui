import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import borderCloud from '@/assets/illustrations/border-cloud.svg'
import exclamations from '@/assets/illustrations/exclamations.svg'
import { Star } from '@/assets'

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
            }
        }
    }

    return (
        <section className="relative overflow-hidden bg-secondary-1 px-4 py-32 text-n-1">
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
                className="absolute right-1/4 top-20"
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
                className="absolute bottom-72 right-[14rem]"
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
                className="absolute right-72 top-1/3 -translate-y-1/2 transform"
            />

            {/* Main content */}
            <div className="relative mx-auto max-w-3xl text-center">
                <h2
                    className="mb-10 font-roboto text-3xl font-black leading-tight md:text-[4rem]"
                    style={{ fontWeight: 900, lineHeight: '0.9' }}
                >
                    SEND IN SECONDS.
                    <br />
                    <span className="mt-6 inline-block">
                        PAY{' '}
                        <span className="relative inline-block align-middle text-[4rem] md:text-[9rem]">
                            {' '}
                            <span className="relative translate-x-[2px] font-knerd-filled text-white">ZERO</span>
                            <span className="absolute -left-[4px] top-3 font-knerd-outline" style={{ fontWeight: 300 }}>
                                ZERO
                            </span>
                        </span>{' '}
                        FEES.
                    </span>
                    <br />
                    START RIGHT NOW.
                </h2>

                <p className="mb-8 font-roboto text-lg font-black md:text-4xl" style={{ fontWeight: 900 }}>
                    MOVE MONEY WORLDWIDE INSTANTLY AND UNDER YOUR CONTROL.
                </p>

                {/* Button with arrows */}
                <div className="relative inline-block">
                    <a
                        href="/setup"
                        className="mt-20 inline-block rounded-sm border-2 border-n-1 bg-white px-12 py-6 text-center font-roboto text-2xl font-black text-n-1 hover:bg-grey-2 focus:outline-none"
                        style={{ fontWeight: 900 }}
                    >
                        TRY NOW
                    </a>

                    {/* Arrow placeholders */}
                    <Image
                        src="/arrows/small-arrow.svg"
                        alt="Arrow pointing to button"
                        width={64}
                        height={32}
                        className="absolute -left-20 top-1/4 -translate-y-1/2 transform"
                    />
                    <Image
                        src="/arrows/small-arrow.svg"
                        alt="Arrow pointing to button"
                        width={64}
                        height={32}
                        className="absolute -right-20 top-1/4 -translate-y-1/2 scale-x-[-1] transform"
                    />
                </div>
            </div>
        </section>
    )
}
