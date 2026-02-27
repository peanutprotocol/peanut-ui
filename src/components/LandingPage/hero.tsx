'use client'

import { ButterySmoothGlobalMoney, PeanutGuyGIF, Star } from '@/assets'
import { motion } from 'framer-motion'
import { Button } from '@/components/0_Bruddle/Button'
import { CloudsCss } from './CloudsCss'

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
                    src={ButterySmoothGlobalMoney.src}
                    className="z-0 mx-auto w-full max-w-[1000px] object-contain md:w-[50%]"
                    alt="Buttery Smooth Global Money"
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
            <img
                src={PeanutGuyGIF.src}
                className="mg:bottom-0 absolute bottom-[55%] left-1/2 z-10 mx-auto h-auto max-h-[40vh] w-auto max-w-[90%] -translate-x-1/2 translate-y-1/2 transform object-contain"
                alt="Peanut Guy"
            />

            <div className="relative z-20 mb-4 flex w-full flex-col items-center justify-center md:mb-0">
                <h2 className="font-roboto-flex-extrabold mt-18 text-center text-[2.375rem] font-extraBlack text-black md:text-heading">
                    TAP. SEND. ANYWHERE
                </h2>
                <span
                    className="mt-2 block text-center text-xl leading-tight text-n-1 md:mt-4 md:text-5xl"
                    style={{ fontWeight: 500, letterSpacing: '-0.5px' }}
                >
                    FROM NEW YORK <br className="block lg:hidden" />
                    TO MADRID <br className="block md:hidden" />
                    TO MEXICO CITY
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
