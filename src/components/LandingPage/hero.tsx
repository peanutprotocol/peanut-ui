import { ButterySmoothGlobalMoney, PeanutGuyGIF, Sparkle } from '@/assets'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { CloudImages, HeroImages } from './imageAssets'
import Image from 'next/image'
import { Button } from '../0_Bruddle'

type CTAButton = {
    label: string
    href: string
    isExternal?: boolean
}

type HeroProps = {
    primaryCta?: CTAButton
    secondaryCta?: CTAButton
    buttonVisible?: boolean
    buttonScale?: number
}

// Helper functions moved outside component for better performance
const getInitialAnimation = (variant: 'primary' | 'secondary') => ({
    opacity: 0,
    translateY: 4,
    translateX: variant === 'primary' ? 0 : 4,
    rotate: 0.75,
})

const getAnimateAnimation = (variant: 'primary' | 'secondary', buttonVisible?: boolean, buttonScale?: number) => ({
    opacity: buttonVisible ? 1 : 0,
    translateY: buttonVisible ? 0 : 20,
    translateX: buttonVisible ? (variant === 'primary' ? 0 : 0) : 20,
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

const getButtonClasses = (variant: 'primary' | 'secondary') =>
    `${variant === 'primary' ? 'btn bg-white fill-n-1 text-n-1 hover:bg-white/90' : 'btn-yellow'} px-7 md:px-9 py-3 md:py-8 text-base md:text-xl btn-shadow-primary-4`

const renderSparkle = (variant: 'primary' | 'secondary') =>
    variant === 'primary' && (
        <img
            src={Sparkle.src}
            className={twMerge('absolute -right-4 -top-4 h-auto w-5 sm:-right-5 sm:-top-5 sm:w-6')}
            alt="Sparkle"
        />
    )

const renderArrows = (variant: 'primary' | 'secondary', arrowOpacity: number, buttonVisible?: boolean) =>
    variant === 'primary' && (
        <>
            <Image
                src="/arrows/small-arrow.svg"
                alt="Arrow pointing to button"
                width={32}
                height={16}
                className="absolute -left-8 -top-5 block -translate-y-1/2 transform md:hidden"
                style={{ opacity: buttonVisible ? arrowOpacity : 0, rotate: '8deg' }}
            />
            <Image
                src="/arrows/small-arrow.svg"
                alt="Arrow pointing to button"
                width={32}
                height={16}
                className="absolute -right-8 -top-5 block -translate-y-1/2 scale-x-[-1] transform md:hidden"
                style={{ opacity: buttonVisible ? arrowOpacity : 0, rotate: '-8deg' }}
            />
            <Image
                src="/arrows/small-arrow.svg"
                alt="Arrow pointing to button"
                width={40}
                height={20}
                className="absolute -left-10 -top-6 hidden -translate-y-1/2 transform md:block"
                style={{ opacity: buttonVisible ? arrowOpacity : 0, rotate: '8deg' }}
            />
            <Image
                src="/arrows/small-arrow.svg"
                alt="Arrow pointing to button"
                width={40}
                height={20}
                className="absolute -right-10 -top-6 hidden -translate-y-1/2 scale-x-[-1] transform md:block"
                style={{ opacity: buttonVisible ? arrowOpacity : 0, rotate: '-8deg' }}
            />
        </>
    )

export function Hero({ primaryCta, secondaryCta, buttonVisible, buttonScale = 1 }: HeroProps) {
    const [screenWidth, setScreenWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)

    useEffect(() => {
        const handleResize = () => {
            setScreenWidth(window.innerWidth)
        }

        handleResize()
        window.addEventListener('resize', handleResize)

        return () => {
            window.removeEventListener('resize', handleResize)
        }
    }, [])

    const renderCTAButton = (cta: CTAButton, variant: 'primary' | 'secondary') => {
        const arrowOpacity = 1 // Always visible

        return (
            <motion.div
                className={getButtonContainerClasses(variant)}
                initial={getInitialAnimation(variant)}
                animate={getAnimateAnimation(variant, buttonVisible, buttonScale)}
                whileHover={getHoverAnimation(variant)}
                transition={transitionConfig}
            >
                {/* {renderSparkle(variant)} */}

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

                {renderArrows(variant, arrowOpacity, buttonVisible)}
            </motion.div>
        )
    }

    return (
        <section className="relative flex min-h-[85vh] w-full flex-col items-center justify-between bg-primary-1 px-4 py-4 xl:h-fit xl:justify-center">
            <CloudImages screenWidth={screenWidth} />
            <div className="relative mt-10 w-full md:mt-0">
                <img
                    src={ButterySmoothGlobalMoney.src}
                    className="z-0 mx-auto w-full max-w-[1000px] object-contain md:w-[50%]"
                    alt="Buttery Smooth Global Money"
                />

                <HeroImages />
            </div>
            <img
                src={PeanutGuyGIF.src}
                className="mg:bottom-0 absolute bottom-[55%] left-1/2 z-10 mx-auto h-auto max-h-[40vh] w-auto max-w-[90%] -translate-x-1/2 translate-y-1/2 transform object-contain"
                alt="Peanut Guy"
            />

            <div className="relative mb-4 flex w-full flex-col items-center justify-center md:mb-0">
                <h2 className="font-roboto-flex-extrabold mt-18 text-center text-[2.375rem] font-extraBlack text-black md:text-heading">
                    TAKE. SEND. ANYWHERE
                </h2>
                <span
                    className="mt-2 block text-center text-xl leading-tight text-n-1 md:mt-4 md:text-5xl"
                    style={{ fontWeight: 500, letterSpacing: '-0.5px' }}
                >
                    FROM NEW YORK TO MADRID TO MEXICO CITY
                </span>
                {primaryCta && renderCTAButton(primaryCta, 'primary')}
                {secondaryCta && renderCTAButton(secondaryCta, 'secondary')}
                <HeroImages />
            </div>
        </section>
    )
}
