'use client'

import { useEffect, useState } from 'react'
import { Stack } from '@chakra-ui/react'
import { MarqueeComp } from '../Global/MarqueeWrapper'
import { HandThumbsUp, Sparkle } from '@/assets'
import { HeroImages, CloudImages } from './imageAssets'
import { motion } from 'framer-motion'

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
    buttonVisible?: boolean // New prop
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
        <div className="relative flex min-h-[96vh] flex-col justify-between overflow-x-hidden md:min-h-[97vh]">
            <CloudImages screenWidth={screenWidth} />

            <div className="lg:mb-16- lg:mt-24- relative mb-8 mt-12 flex grow flex-col justify-between space-y-6 md:mb-10 md:mt-12">
                <img
                    src="/peanut_guy.gif" // Updated to use animated gif
                    className="mg:bottom-0 absolute bottom-4 left-1/2 mx-auto h-3/5 w-auto max-w-[none] -translate-x-1/2 transform md:w-auto"
                    alt=""
                />

                <Stack spacing={2} className="relative h-1/3 justify-center px-4 text-center lg:h-auto">
                    <HeroImages />

                    <h1 className="relative text-center font-display text-[21vw] font-black leading-[1] sm:text-7xl lg:text-9xl">
                        {heading}
                    </h1>

                    <h2 className="relative font-condensed text-4xl uppercase leading-[1.15] lg:text-[3rem]">
                        buttery smooth global money
                    </h2>
                </Stack>
            </div>

            <div className="relative z-1">
                {marquee && <MarqueeComp message={marquee.message} imageSrc={HandThumbsUp.src} />}
            </div>

            {cta?.href && cta?.label && (
                <motion.div
                    className="fixed bottom-4 right-[calc(50%-60px)] z-[99] sm:bottom-8"
                    initial={{
                        opacity: 0,
                        translateY: 4,
                        translateX: 4,
                        rotate: 0.75,
                    }}
                    animate={{
                        opacity: buttonVisible ? 1 : 0,
                        translateY: buttonVisible ? 0 : -20,
                        translateX: buttonVisible ? 0 : 20,
                        rotate: buttonVisible ? 0 : 1,
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
