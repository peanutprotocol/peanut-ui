'use client'
import Image from 'next/image'
import { MarqueeWrapper } from '../Global/MarqueeWrapper'
import {
    BBVA_ICON,
    BRUBANK_ICON,
    N26_ICON,
    SANTANDER_ICON,
    REVOLUT_ICON,
    STRIPE_ICON,
    MERCADO_PAGO_ICON,
    PIX_ICON,
    WISE_ICON,
} from '@/assets'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import borderCloud from '@/assets/illustrations/border-cloud.svg'
import { Star } from '@/assets'

const bgColor = '#F9F4F0'

const logos = [
    { logo: BBVA_ICON, alt: 'BBVA' },
    { logo: BRUBANK_ICON, alt: 'Brubank' },
    { logo: N26_ICON, alt: 'N26' },
    { logo: SANTANDER_ICON, alt: 'Santander' },
    { logo: REVOLUT_ICON, alt: 'Revolut' },
    { logo: STRIPE_ICON, alt: 'Stripe' },
    { logo: MERCADO_PAGO_ICON, alt: 'Mercado Pago' },
    { logo: PIX_ICON, alt: 'PIX' },
    { logo: WISE_ICON, alt: 'Wise' },
]

export function RegulatedRails() {
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
        <section className="relative overflow-hidden py-20 text-n-1" style={{ backgroundColor: bgColor }}>
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
            <div className="relative max-w-5xl px-10 py-8 md:px-24 md:py-16">
                {/* Animated stars */}
                <motion.img
                    src={Star.src}
                    alt="Floating Star"
                    width={50}
                    height={50}
                    className="absolute -right-72 -top-12"
                    initial={{ opacity: 0, translateY: 20, translateX: 5, rotate: 22 }}
                    whileInView={{ opacity: 1, translateY: 0, translateX: 0, rotate: 22 }}
                    transition={{ type: 'spring', damping: 5, delay: 0.2 }}
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
                <h1 className="font-roboto-flex-extrabold text-left text-[3.25rem] font-extraBlack !leading-[5rem] md:text-6xl lg:text-headingMedium">
                    REGULATED RAILS, SELF-CUSTODY CONTROL
                </h1>
                <p className="mt-6 text-left text-base md:text-2xl">
                    Peanut connects your self-custodial wallet to global regulated banks and top compliance partners. It
                    operates under international licenses and standards to keep every transaction secure, private, and
                    under your control.
                </p>

                <h6 className="mt-3 text-sm">
                    Verified with Persona: SOC 2, ISO 27001, GDPR. Zero data stored by Peanut.
                </h6>
            </div>

            <div className="w-full">
                <MarqueeWrapper backgroundColor="#FFFFFF" direction="right" className="border-none ">
                    {logos.map((logo) => (
                        <div
                            key={logo.alt}
                            className="btn btn-purple btn-shadow-primary-4 mx-7 mb-2 flex h-26 w-48 items-center gap-2"
                        >
                            <Image src={logo.logo} alt={logo.alt} width={101} height={32} />
                        </div>
                    ))}
                </MarqueeWrapper>
            </div>
        </section>
    )
}
