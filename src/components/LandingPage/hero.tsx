import { ButterySmoothGlobalMoney, PeanutGuyGIF, Sparkle } from '@/assets'
import { Stack } from '@chakra-ui/react'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { CloudImages, HeroImages } from './imageAssets'

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
}

export function Hero({ heading, primaryCta, secondaryCta, buttonVisible }: HeroProps) {
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
                variant === 'primary' ? 'inset-x-0 mx-auto w-fit' : 'right-[calc(50%-120px)]'
            }`}
            initial={{
                opacity: 0,
                translateY: 4,
                translateX: variant === 'primary' ? 0 : 4,
                rotate: 0.75,
            }}
            animate={{
                opacity: buttonVisible ? 1 : 0,
                translateY: buttonVisible ? 0 : 20,
                translateX: buttonVisible ? (variant === 'primary' ? 0 : 0) : 20,
                rotate: buttonVisible ? 0 : 1,
                pointerEvents: buttonVisible ? 'auto' : 'none',
            }}
            whileHover={{
                translateY: 6,
                translateX: variant === 'primary' ? 0 : 3,
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
                className={`${variant === 'primary' ? 'btn bg-white fill-n-1 text-n-1 hover:bg-white/90' : 'btn-yellow'} px-5 shadow-md`}
                target={cta.isExternal ? '_blank' : undefined}
                rel={cta.isExternal ? 'noopener noreferrer' : undefined}
            >
                {cta.label}
            </a>
        </motion.div>
    )

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
                    <h2 className="mt-20 font-roboto text-4xl text-n-1 md:text-[3.5rem]" style={{ fontWeight: 900 }}>
                        INSTANTLY SEND AND RECEIVE
                        <br />
                        <span className="mt-4 block md:text-5xl">MONEY ACROSS THE GLOBE</span>
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
