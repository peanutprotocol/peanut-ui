'use client'
import { useEffect, useState } from 'react'

import { Stack, Center, Box } from '@chakra-ui/react'
import { MarqueeComp } from '../Global/MarqueeWrapper'
import { HandThumbs, PeanutGuy } from '@/assets'
import { HeroImages, CloudImages } from './imageAssets'
import { motion } from 'framer-motion'

type HeroProps = {
    heading: string
    marquee?: {
        visible: boolean
        message?: string
    }
}

export function Hero({ heading, marquee = { visible: false } }: HeroProps) {
    const [duration, setDuration] = useState(10)
    const [screenWidth, setScreenWidth] = useState(window.innerWidth)

    useEffect(() => {
        const handleResize = () => {
            setScreenWidth(window.innerWidth)
        }

        handleResize() // Call once initially to set duration
        window.addEventListener('resize', handleResize) // Recalculate on window resize

        return () => window.removeEventListener('resize', handleResize)
    }, [])

    return (
        <div className="relative flex min-h-[60vh] flex-col justify-between overflow-x-hidden">
            <CloudImages screenWidth={screenWidth} />
            <HeroImages />

            {/* <Stack height={`calc(100vh - 4rem - 4rem)`}> */}
            <div className="mb-10 mt-20 flex h-auto h-full flex-col justify-between space-y-6 md:mb-10 md:mt-12">
                <Stack spacing={2} className="text-center">
                    <h1 className="lg:mt-32- relative text-center font-display text-[21vw] font-black leading-[1] sm:text-7xl lg:text-9xl">
                        {heading}
                    </h1>

                    <h2 className="font-condensed relative text-6xl leading-[1] lg:text-[4rem]">
                        buttery smooth global money
                    </h2>
                </Stack>

                <img src={PeanutGuy.src} className="mx-auto w-1/3 md:w-1/5" alt="" />
            </div>

            <div className="relative z-1">
                {marquee && <MarqueeComp message={marquee.message} imageSrc={HandThumbs.src} />}
            </div>

            <motion.div
                className="fixed bottom-6 right-4 z-[99] sm:bottom-14 md:right-8"
                initial={{
                    opacity: 0,
                    translateY: 4,
                    translateX: 4,
                    rotate: 0.75,
                }}
                whileInView={{
                    opacity: 1,
                    translateY: 0,
                    translateX: 0,
                    rotate: 0,
                }}
                whileHover={{
                    translateY: 6,
                    translateX: 3,
                    rotate: 0.75,
                }}
                transition={{ type: 'spring', damping: 15 }}
            >
                <a href="#club" className="btn-purple px-5 shadow-md">
                    JOIN NOW
                </a>
            </motion.div>
        </div>
    )
}
