import { ButterySmoothGlobalMoney, HandThumbsUp, PeanutGuyGIF, Sparkle } from '@/assets'
import { Stack } from '@chakra-ui/react'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { MarqueeComp } from '../Global/MarqueeWrapper'
import { CloudImages, HeroImages } from './imageAssets'

type CTAButton = {
    label: string
    href: string
    isExternal?: boolean
}

type HeroProps = {
    heading: string
    marquee?: {
        visible: boolean
        message?: string[]
    }
    primaryCta?: CTAButton
    secondaryCta?: CTAButton
    buttonVisible?: boolean
}

export function Hero({ heading, marquee = { visible: false }, primaryCta, secondaryCta, buttonVisible }: HeroProps) {
    const [duration, setDuration] = useState(10)
    const [screenWidth, setScreenWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200) // Added typeof check for SSR

    useEffect(() => {
        const handleResize = () => {
            setScreenWidth(window.innerWidth)
        }

        handleResize() // Call once initially to set duration
        window.addEventListener('resize', handleResize) // Recalculate on window resize

        return () => window.removeEventListener('resize', handleResize)
    }, [])

    const renderCTAButton = (cta: CTAButton, variant: 'primary' | 'secondary') => (
        <motion.div
            className={`fixed bottom-4 z-20 sm:bottom-8 ${
                variant === 'primary' ? 'right-[calc(50%)]' : 'right-[calc(50%-120px)]'
            }`}
            initial={{
                opacity: 0,
                translateY: 4,
                translateX: 4,
                rotate: 0.75,
            }}
            animate={{
                opacity: buttonVisible ? 1 : 0,
                translateY: buttonVisible ? 0 : 20,
                translateX: buttonVisible ? 0 : 20,
                rotate: buttonVisible ? 0 : 1,
                pointerEvents: buttonVisible ? 'auto' : 'none',
            }}
            whileHover={{
                translateY: 6,
                translateX: 3,
                rotate: 0.75,
            }}
            transition={{ type: 'spring', damping: 15 }}
        >
            {variant === 'primary' && (
                <img
                    src={Sparkle.src}
                    className={twMerge('absolute -right-4 -top-4 h-auto w-5 sm:-right-5 sm:-top-5 sm:w-6')}
                    alt="Sparkle"
                />
            )}

            <a
                href={cta.href}
                className={`${variant === 'primary' ? 'btn-purple' : 'btn-yellow'} px-5 shadow-md`}
                target={cta.isExternal ? '_blank' : undefined}
                rel={cta.isExternal ? 'noopener noreferrer' : undefined}
            >
                {cta.label}
            </a>
        </motion.div>
    )

    return (
        <div className="relative flex min-h-[96vh] flex-col justify-between overflow-x-hidden bg-primary-1 md:min-h-[100dvh]">
            <CloudImages screenWidth={screenWidth} />

            <div className="lg:mb-16- lg:mt-24- relative mb-8 mt-12 flex grow flex-col justify-between space-y-6 md:mb-10 md:mt-12">
                <img
                    src={PeanutGuyGIF.src}
                    className="mg:bottom-0 absolute bottom-4 left-1/2 z-10 mx-auto h-auto max-h-[60vh] w-auto max-w-[90%] -translate-x-1/2 transform object-contain md:w-auto"
                    alt="Peanut Guy"
                />

                <Stack spacing={2} className="relative h-1/3 justify-center px-4 text-center lg:h-auto">
                    <img
                        src={ButterySmoothGlobalMoney.src}
                        className="z-0 mx-auto w-full max-w-[1000px] object-contain lg:w-3/4"
                        alt="Buttery Smooth Global Money"
                    />

                    <HeroImages />
                </Stack>
            </div>

            <div className="relative z-1">
                {marquee?.visible && (
                    <MarqueeComp
                        message={marquee.message}
                        imageSrc={HandThumbsUp.src}
                        backgroundColor="bg-secondary-1"
                    />
                )}
            </div>

            <div>
                {primaryCta && renderCTAButton(primaryCta, 'primary')}
                {secondaryCta && renderCTAButton(secondaryCta, 'secondary')}
            </div>
        </div>
    )
}
