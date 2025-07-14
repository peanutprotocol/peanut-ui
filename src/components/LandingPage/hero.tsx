import { AboutPeanut, ButterySmoothGlobalMoney, HandThumbsUp, PeanutGuyGIF, Sparkle } from '@/assets'
import { Stack } from '@chakra-ui/react'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { CloudImages, HeroImages } from './imageAssets'

type HeroProps = {
    heading: string
    marquee?: {
        visible: boolean
        message?: string
    }
    cta?: {
        label: string
        href: string
    }
    buttonVisible?: boolean
}

export function Hero({ heading, marquee = { visible: false }, cta, buttonVisible }: HeroProps) {
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

    return (
        <div className="relative flex min-h-[96vh] flex-col justify-between overflow-x-hidden bg-pink-1 md:min-h-[97vh]">
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
                    <img
                        src={AboutPeanut.src}
                        className="z-0 mx-auto w-full max-w-[1000px] object-contain pt-6 lg:w-[40%]"
                        alt="Buttery Smooth Global Money"
                    />

                    <HeroImages />
                </Stack>
            </div>

            {cta?.href && cta?.label && (
                <motion.div
                    className="fixed bottom-4 right-[calc(50%-60px)] z-20 sm:bottom-8"
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
                    <img
                        src={Sparkle.src}
                        className="absolute -right-4 -top-4 h-auto w-5 sm:-right-5 sm:-top-5 sm:w-6"
                        alt="Sparkle"
                    />

                    <a href={cta.href} className="btn-purple px-5 shadow-md">
                        {cta.label}
                    </a>
                </motion.div>
            )}
        </div>
    )
}
