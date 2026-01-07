'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import borderCloud from '@/assets/illustrations/border-cloud.svg'
import noHiddenFees from '@/assets/illustrations/no-hidden-fees.svg'
import { Star } from '@/assets'
import Image from 'next/image'
import ExchangeRateWidget from '../Global/ExchangeRateWidget'
import { useRouter } from 'next/navigation'
import { printableUsdc } from '@/utils/balance.utils'
import { getExchangeRateWidgetRedirectRoute } from '@/utils/exchangeRateWidget.utils'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useAuth } from '@/context/authContext'
import { twMerge } from 'tailwind-merge'

export function NoFees({ className }: { className?: string }) {
    const [screenWidth, setScreenWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)
    const router = useRouter()
    const { fetchBalance, balance } = useWallet()
    const { user } = useAuth()

    const handleCtaAction = (sourceCurrency: string, destinationCurrency: string) => {
        if (!user) {
            router.push('/setup')
            return
        }
        const formattedBalance = parseFloat(printableUsdc(balance ?? 0n))

        const redirectRoute = getExchangeRateWidgetRedirectRoute(sourceCurrency, destinationCurrency, formattedBalance)
        router.push(redirectRoute)
    }

    useEffect(() => {
        const handleResize = () => {
            setScreenWidth(window.innerWidth)
        }

        handleResize()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    useEffect(() => {
        if (user) {
            fetchBalance()
        }
    }, [user])

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
        <section className={twMerge('relative overflow-hidden bg-secondary-3 px-4 py-24 md:py-14', className)}>
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
                    className="absolute -right-0 -top-16 md:top-58"
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

                <h1 className="font-roboto-flex-extrabold text-heading text-black md:text-headingMedium">ZERO FEES</h1>

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

                <ExchangeRateWidget ctaIcon="arrow-up-right" ctaLabel="Send Money" ctaAction={handleCtaAction} />
            </div>
        </section>
    )
}
