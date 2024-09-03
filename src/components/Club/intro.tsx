'use client'

import { Flex, Stack, Box } from '@chakra-ui/react'
import { motion } from 'framer-motion'
import * as assets from '@/assets'

type HeroProps = {
    heading: string
    marquee?: {
        visible: boolean
        message?: string
    }
}

export function Intro() {
    const inlineStyle = {
        backgroundImage: `url(${assets.PeanutsBG.src})`,
        backgroundSize: '8rem auto',
        backgroundRepeat: 'repeat',
    }

    const lineClass =
        'relative mx-auto w-full items-center space-x-4 md:space-x-6 px-2 md:px-6 lg:px-10 xl:w-[92%] 2xl:w-4/5'
    const boxClass = 'h-[10vw] md:h-[7vw] grow rounded-lg border-4 border-n-1 bg-gold-3 ring-2 ring-white shadow-md'
    const textClass = 'text-[11vw] md:text-[8vw] font-semibold leading-[0.95]'

    return (
        <Stack className="mt-12 lg:mt-20">
            <Flex className={lineClass}>
                <span className={textClass}>PAY</span>
                <span className={boxClass} style={inlineStyle}></span>
                <span className={textClass}>FRENS</span>
                <motion.img
                    initial={{ opacity: 0, translateY: 20, translateX: 5 }}
                    whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                    transition={{ type: 'spring', damping: 5 }}
                    src={assets.EasySignTight.src}
                    className="hidden h-[7.5vw] w-auto md:block"
                />
            </Flex>

            <Flex className={lineClass}>
                <motion.img
                    initial={{ opacity: 0, translateY: 24, translateX: -5 }}
                    whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                    transition={{ type: 'spring', damping: 5 }}
                    src={assets.PeaceFingers.src}
                    className="h-[8vw] w-auto -rotate-6"
                />
                <span className={textClass}>WITH</span>
                <span className={`${boxClass} `} style={inlineStyle}></span>
                <span className={textClass}>LINKS</span>
            </Flex>

            <Box className="mt-12 px-6 md:mt-20 md:px-8 lg:mt-28">
                <img src={assets.HR.src} className="mx-auto h-5" />
            </Box>
        </Stack>
    )
}
