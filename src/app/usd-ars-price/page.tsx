'use client'

import Layout from '@/components/Global/Layout'
import { motion } from 'framer-motion'
import borderCloud from '@/assets/illustrations/border-cloud.svg'
import noHiddenFees from '@/assets/illustrations/no-hidden-fees.svg'
import { useEffect, useState } from 'react'
import { Star } from '@/assets'
import Image from 'next/image'
import { useExchangeRate } from '@/hooks/useExchangeRate'

export default function UsdArsPrice() {
    const [screenWidth, setScreenWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)

    const { sourceAmount, destinationAmount, isLoading, isError } = useExchangeRate({
        sourceCurrency: 'USD',
        destinationCurrency: 'ARS',
        initialSourceAmount: 1,
    })

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

    useEffect(() => {
        const handleResize = () => {
            setScreenWidth(window.innerWidth)
        }

        handleResize()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    return (
        <Layout className="enable-select !m-0 w-full !p-0">
            <section
                className={
                    'relative flex h-full flex-col items-center justify-center overflow-hidden bg-secondary-3 px-4 py-24 md:py-14'
                }
            >
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

                <div className="relative mx-auto w-full max-w-3xl text-center">
                    {/* Animated stars */}

                    <motion.img
                        src={Star.src}
                        alt="Floating Star"
                        width={50}
                        height={50}
                        className="absolute -right-10 -top-16 md:top-44"
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
                        className="absolute -bottom-6 -left-2 top-64"
                        initial={{ opacity: 0, translateY: 25, translateX: -5, rotate: -5 }}
                        whileInView={{ opacity: 1, translateY: 0, translateX: 0, rotate: -5 }}
                        transition={{ type: 'spring', damping: 5, delay: 1.0 }}
                    />

                    <h1 className="font-roboto-flex-extrabold text-heading text-black md:text-headingLarge">
                        ZERO FEES
                    </h1>

                    {/* No hidden fees SVG */}
                    <div className="mb-1">
                        <Image
                            src={noHiddenFees}
                            alt="Really, we mean zero. No hidden fees"
                            width={800}
                            height={200}
                            className="mx-auto h-auto w-full max-w-xs md:max-w-3xl"
                        />
                    </div>

                    {/* <ExchangeRateWidget ctaIcon="arrow-up-right" ctaLabel="Send Money" ctaAction={handleCtaAction} /> */}

                    <div className="mt-10 flex items-center justify-center border-4 border-black bg-white p-10 md:p-20">
                        {isLoading && <div className="mx-auto h-8 w-full animate-pulse rounded-full bg-grey-2" />}

                        {!isLoading && isError && (
                            <p className="font-roboto text-3xl font-bold ">
                                Couldn&apos;t load ARS rate. Please try again.
                            </p>
                        )}
                        {!isLoading && !isError && (
                            <p className="font-roboto text-3xl font-bold md:text-[70px] md:font-extraBlack">
                                ${sourceAmount} = {destinationAmount} ARS
                            </p>
                        )}
                    </div>
                </div>
            </section>
        </Layout>
    )
}
