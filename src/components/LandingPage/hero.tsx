import { ButterySmoothGlobalMoney, PeanutGuyGIF, Sparkle } from '@/assets'
import { Stack } from '@chakra-ui/react'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { CloudImages, HeroImages } from './imageAssets'
import Image from 'next/image'

type CTAButton = {
    label: string
    href: string
    isExternal?: boolean
}

type HeroProps = {
    heading: string
    primaryCta?: CTAButton
    secondaryCta?: CTAButton
    buttonVisible?: boolean
    sendInSecondsInView?: boolean
}

// Helper functions moved outside component for better performance
const getInitialAnimation = (variant: 'primary' | 'secondary') => ({
    opacity: 0,
    translateY: 4,
    translateX: variant === 'primary' ? 0 : 4,
    rotate: 0.75,
})

const getAnimateAnimation = (variant: 'primary' | 'secondary', buttonVisible?: boolean, sendInSecondsInView?: boolean) => ({
    opacity: buttonVisible ? (sendInSecondsInView ? 0.2 : 1) : 0,
    translateY: buttonVisible ? 0 : 20,
    translateX: buttonVisible ? (variant === 'primary' ? 0 : 0) : 20,
    rotate: buttonVisible ? 0 : 1,
    pointerEvents: buttonVisible ? ('auto' as const) : ('none' as const),
})

const getHoverAnimation = (variant: 'primary' | 'secondary') => ({
    translateY: 6,
    translateX: variant === 'primary' ? 0 : 3,
    rotate: 0.75,
})

const transitionConfig = { type: 'spring', damping: 15 } as const

const getButtonContainerClasses = (variant: 'primary' | 'secondary') =>
    `fixed bottom-4 z-20 sm:bottom-8 ${
        variant === 'primary' ? 'inset-x-0 mx-auto w-fit' : 'right-[calc(50%-120px)]'
    }`

const getButtonClasses = (variant: 'primary' | 'secondary') =>
    `${variant === 'primary' ? 'btn bg-white fill-n-1 text-n-1 hover:bg-white/90' : 'btn-yellow'} px-5 shadow-md`

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
                width={64}
                height={32}
                className="absolute -left-20 -top-6 hidden -translate-y-1/2 transform md:block"
                style={{ opacity: buttonVisible ? arrowOpacity : 0 }}
            />
            <Image
                src="/arrows/small-arrow.svg"
                alt="Arrow pointing to button"
                width={64}
                height={32}
                className="absolute -right-20 -top-6 hidden -translate-y-1/2 scale-x-[-1] transform md:block"
                style={{ opacity: buttonVisible ? arrowOpacity : 0 }}
            />
        </>
    )

export function Hero({ heading, primaryCta, secondaryCta, buttonVisible, sendInSecondsInView = false }: HeroProps) {
    const [screenWidth, setScreenWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)
    const [scrollY, setScrollY] = useState(0)

    useEffect(() => {
        const handleResize = () => {
            setScreenWidth(window.innerWidth)
        }

        const handleScroll = () => {
            setScrollY(window.scrollY)
        }

        handleResize()
        window.addEventListener('resize', handleResize)
        window.addEventListener('scroll', handleScroll)

        return () => {
            window.removeEventListener('resize', handleResize)
            window.removeEventListener('scroll', handleScroll)
        }
    }, [])

    const renderCTAButton = (cta: CTAButton, variant: 'primary' | 'secondary') => {
        const arrowOpacity = Math.max(0, 1 - scrollY / 300) // Fade arrows after 300px of scroll

        return (
            <motion.div
                className={getButtonContainerClasses(variant)}
                initial={getInitialAnimation(variant)}
                animate={getAnimateAnimation(variant, buttonVisible, sendInSecondsInView)}
                whileHover={getHoverAnimation(variant)}
                transition={transitionConfig}
            >
                {renderSparkle(variant)}

                <a
                    href={cta.href}
                    className={getButtonClasses(variant)}
                    target={cta.isExternal ? '_blank' : undefined}
                    rel={cta.isExternal ? 'noopener noreferrer' : undefined}
                >
                    {cta.label}
                </a>

                {renderArrows(variant, arrowOpacity, buttonVisible)}
            </motion.div>
        )
    }

    return (
        <div className="relative flex min-h-[100dvh] flex-col justify-between overflow-x-hidden bg-primary-1">
            <CloudImages screenWidth={screenWidth} />

            <div className="relative mb-8 mt-12 flex grow flex-col justify-between space-y-6 md:mb-10 md:mt-12">
                <img
                    src={PeanutGuyGIF.src}
                    className="mg:bottom-0 absolute bottom-1/2 left-1/2 z-10 mx-auto h-auto max-h-[60vh] w-auto max-w-[90%] -translate-x-1/2 translate-y-1/2 transform object-contain"
                    alt="Peanut Guy"
                />

                <Stack spacing={2} className="relative h-1/3 items-center justify-center px-4 text-center lg:h-full">
                    <img
                        src={ButterySmoothGlobalMoney.src}
                        className="z-0 mx-auto w-full max-w-[1000px] object-contain lg:w-3/4"
                        alt="Buttery Smooth Global Money"
                    />

                    <HeroImages />
                </Stack>

                <Stack spacing={2} className="relative h-1/3 items-center justify-center px-4 text-center lg:h-full">
                    <h2
                        className="mt-8 font-roboto text-2xl leading-tight text-n-1 md:mt-20 md:text-[3.5rem]"
                        style={{ fontWeight: 900 }}
                    >
                        INSTANTLY SEND AND RECEIVE
                        <br />
                        <span className="mt-2 block text-xl md:mt-4 md:text-5xl">MONEY ACROSS THE GLOBE</span>
                    </h2>

                    <HeroImages />
                </Stack>
            </div>

            <div>
                {primaryCta && renderCTAButton(primaryCta, 'primary')}
                {secondaryCta && renderCTAButton(secondaryCta, 'secondary')}
            </div>
        </div>
    )
}
