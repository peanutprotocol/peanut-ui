'use client'

import { GlobalCashLocalFeel, PeanutGuyGIF, Star } from '@/assets'
import { motion } from 'framer-motion'
import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { CloudsCss } from './CloudsCss'

/**
 * Peanut mascot that positions itself so only 3% of its height (the feet)
 * overlaps with the h2 subtitle below. Measures the h2 position on mount
 * and resize, then sets its own bottom edge to sit 3% into the h2.
 */
function PeanutMascot() {
    const [style, setStyle] = useState<React.CSSProperties>({})

    const position = useCallback(() => {
        const hero = document.getElementById('hero')
        const h2 = hero?.querySelector('h2')
        if (!hero || !h2) return

        const heroRect = hero.getBoundingClientRect()
        const h2Rect = h2.getBoundingClientRect()

        // We want the peanut bottom to be 3% of peanut height below the h2 top
        // peanut bottom = h2Top + 0.03 * peanutHeight
        // But we don't know peanut height yet — use max-h-[40vh] as estimate
        const peanutHeight = Math.min(window.innerHeight * 0.4, 360)
        const overlap = peanutHeight * 0.03
        const peanutBottom = h2Rect.top - heroRect.top + overlap
        const peanutTop = peanutBottom - peanutHeight

        setStyle({
            position: 'absolute' as const,
            top: `${peanutTop}px`,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            height: 'auto',
            maxHeight: '40vh',
            width: 'auto',
            maxWidth: '90%',
            objectFit: 'contain' as const,
        })
    }, [])

    useEffect(() => {
        // Position after fonts/images load
        const timer = setTimeout(position, 200)
        window.addEventListener('resize', position)
        return () => {
            clearTimeout(timer)
            window.removeEventListener('resize', position)
        }
    }, [position])

    return <img src={PeanutGuyGIF.src} alt="Peanut Guy" style={style} />
}

type CTAButton = {
    label: string
    href: string
    isExternal?: boolean
    subtext?: string
}

type HeroProps = {
    primaryCta?: CTAButton
    secondaryCta?: CTAButton
    buttonVisible?: boolean
    buttonScale?: number
}

const getInitialAnimation = (variant: 'primary' | 'secondary') => ({
    opacity: 0,
    translateY: 4,
    translateX: variant === 'primary' ? 0 : 4,
    rotate: 0.75,
})

const getAnimateAnimation = (variant: 'primary' | 'secondary', buttonVisible?: boolean, buttonScale?: number) => ({
    opacity: buttonVisible ? 1 : 0,
    translateY: buttonVisible ? 0 : 20,
    translateX: buttonVisible ? 0 : 20,
    rotate: buttonVisible ? 0 : 1,
    scale: buttonScale || 1,
    pointerEvents: buttonVisible ? ('auto' as const) : ('none' as const),
})

const getHoverAnimation = (variant: 'primary' | 'secondary') => ({
    translateY: 6,
    translateX: variant === 'primary' ? 0 : 3,
    rotate: 0.75,
})

const transitionConfig = { type: 'spring', damping: 15 } as const

const getButtonContainerClasses = (variant: 'primary' | 'secondary') =>
    `relative z-20 mt-8 md:mt-12 flex flex-col items-center justify-center ${variant === 'primary' ? 'mx-auto w-fit' : 'right-[calc(50%-120px)]'}`

export function Hero({ primaryCta, secondaryCta, buttonVisible, buttonScale = 1 }: HeroProps) {
    const renderCTAButton = (cta: CTAButton, variant: 'primary' | 'secondary') => {
        return (
            <motion.div
                className={getButtonContainerClasses(variant)}
                initial={getInitialAnimation(variant)}
                animate={getAnimateAnimation(variant, buttonVisible, buttonScale)}
                whileHover={getHoverAnimation(variant)}
                transition={transitionConfig}
            >
                <a
                    href={cta.href}
                    target={cta.isExternal ? '_blank' : undefined}
                    rel={cta.isExternal ? 'noopener noreferrer' : undefined}
                >
                    <Button
                        shadowSize="4"
                        className="bg-white px-7 py-3 text-base font-extrabold hover:bg-white/90 md:px-9 md:py-8 md:text-xl"
                    >
                        {cta.label}
                    </Button>
                </a>
                {cta.subtext && (
                    <span className="mt-2 block text-center text-sm italic text-n-1 md:text-base">{cta.subtext}</span>
                )}
            </motion.div>
        )
    }

    return (
        <section
            id="hero"
            className="relative flex min-h-[85vh] w-full flex-col items-center justify-between bg-primary-1 px-4 py-4 xl:h-fit xl:justify-center"
        >
            <CloudsCss />
            <div className="relative mt-10 w-full md:mt-0">
                <img
                    src={GlobalCashLocalFeel.src}
                    className="z-0 mx-auto w-full max-w-[1000px] object-contain md:w-[50%]"
                    alt="Global Cash Local Feel"
                />

                <motion.img
                    initial={{ opacity: 0, translateY: 20, translateX: 5 }}
                    whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                    transition={{ type: 'spring', damping: 5 }}
                    src={Star.src}
                    alt=""
                    className="absolute bottom-[-4%] left-[1%] w-8 sm:bottom-[11%] sm:left-[12%] md:bottom-[18%] md:left-[5%] md:w-12"
                />
                <motion.img
                    initial={{ opacity: 0, translateY: 28, translateX: -5 }}
                    whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                    transition={{ type: 'spring', damping: 5 }}
                    src={Star.src}
                    alt=""
                    className="absolute right-[1.5%] top-[-12%] w-8 sm:right-[6%] sm:top-[8%] md:right-[5%] md:top-[8%] md:w-12 lg:right-[10%]"
                />
            </div>
            <PeanutMascot />

            <div className="relative z-20 mb-4 flex w-full flex-col items-center justify-center md:mb-0">
                <h2 className="font-roboto-flex-extrabold mt-18 text-center text-[2.375rem] font-extraBlack text-black md:text-heading">
                    TAP. SCAN. ANYWHERE.
                </h2>
                <span
                    className="mt-2 block text-center text-xl leading-tight text-n-1 md:mt-4 md:text-5xl"
                    style={{ fontWeight: 500, letterSpacing: '-0.5px' }}
                >
                    Buenos Aires. São Paulo. Floripa.
                </span>
                <span className="mt-2 block text-center text-sm text-n-1/70 md:text-base" style={{ fontWeight: 400 }}>
                    No local ID or bank required.
                </span>
                {primaryCta && renderCTAButton(primaryCta, 'primary')}
                {secondaryCta && renderCTAButton(secondaryCta, 'secondary')}
                <motion.img
                    initial={{ opacity: 0, translateY: 20, translateX: 5 }}
                    whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                    transition={{ type: 'spring', damping: 5 }}
                    src={Star.src}
                    alt=""
                    className="absolute bottom-[-4%] left-[1%] w-8 sm:bottom-[11%] sm:left-[12%] md:bottom-[18%] md:left-[5%] md:w-12"
                />
                <motion.img
                    initial={{ opacity: 0, translateY: 28, translateX: -5 }}
                    whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                    transition={{ type: 'spring', damping: 5 }}
                    src={Star.src}
                    alt=""
                    className="absolute right-[1.5%] top-[-12%] w-8 sm:right-[6%] sm:top-[8%] md:right-[5%] md:top-[8%] md:w-12 lg:right-[10%]"
                />
            </div>
        </section>
    )
}
