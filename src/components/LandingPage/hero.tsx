import { ButterySmoothGlobalMoney, PeanutGuyGIF, Sparkle } from '@/assets'
import { Stack } from '@chakra-ui/react'
import { motion } from 'framer-motion'
import { twMerge } from 'tailwind-merge'
import { CloudImages, HeroImages } from './imageAssets'
import Image from 'next/image'
import instantlySendReceive from '@/assets/illustrations/instantly-send-receive.svg'
import { useResizeHandler, useScrollHandler, createButtonAnimation } from '@/hooks/useAnimations'

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
    buttonScale?: number
}

// Helper functions moved outside component for better performance

const getButtonContainerClasses = (variant: 'primary' | 'secondary') =>
    `relative z-20 mt-8 md:mt-12 ${variant === 'primary' ? 'mx-auto w-fit' : 'right-[calc(50%-120px)]'}`

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

export function Hero({ heading, primaryCta, secondaryCta, buttonVisible, buttonScale = 1 }: HeroProps) {
    const screenWidth = useResizeHandler()
    const scrollY = useScrollHandler()
    
    const primaryButtonAnimation = createButtonAnimation(
        buttonVisible || false,
        buttonScale,
        { translateX: 0 },
        { translateX: 0 }
    )
    
    const secondaryButtonAnimation = createButtonAnimation(
        buttonVisible || false,
        buttonScale,
        { translateX: 4 },
        { translateX: 3 }
    )

    const renderCTAButton = (cta: CTAButton, variant: 'primary' | 'secondary') => {
        const arrowOpacity = 1 // Always visible
        const animation = variant === 'primary' ? primaryButtonAnimation : secondaryButtonAnimation

        return (
            <motion.div
                className={getButtonContainerClasses(variant)}
                initial={animation.initial}
                animate={animation.animate}
                whileHover={animation.hover}
                transition={animation.transition}
            >
                {/* {renderSparkle(variant)} */}

                <a
                    href={cta.href}
                    className={getButtonClasses(variant)}
                    target={cta.isExternal ? '_blank' : undefined}
                    style={{ fontWeight: 900 }}
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

                <Stack spacing={2} className="relative h-1/3 !mb-56 md:!mb-20 items-center justify-center px-4 text-center lg:h-full">
                    <img
                        src={ButterySmoothGlobalMoney.src}
                        className="z-0 mx-auto w-full max-w-[1000px] object-contain lg:w-3/4"
                        alt="Buttery Smooth Global Money"
                    />

                    <HeroImages />
                </Stack>

                <Stack spacing={2} className="relative h-1/3 items-center justify-center px-4 text-center lg:h-full">
                    <div className="mt-8 md:mt-20">
                        <Image
                            src={instantlySendReceive}
                            alt="Instantly Send and Receive"
                            width={800}
                            height={150}
                            className="mx-auto h-auto w-full max-w-lg md:max-w-4xl"
                        />
                        <span
                            className="mt-2 block text-xl leading-tight text-n-1 md:mt-4 md:text-5xl"
                            style={{ fontWeight: 500, letterSpacing: '-0.5px' }}
                        >
                            MONEY ACROSS THE GLOBE
                        </span>
                    </div>

                    {primaryCta && renderCTAButton(primaryCta, 'primary')}
                    {secondaryCta && renderCTAButton(secondaryCta, 'secondary')}

                    <HeroImages />
                </Stack>
            </div>
        </div>
    )
}
