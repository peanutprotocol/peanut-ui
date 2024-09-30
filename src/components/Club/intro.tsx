'use client'

import { Flex, Stack, Box } from '@chakra-ui/react'
import { motion } from 'framer-motion'
import { PeanutsBG, EasySignTight, PeaceFingers } from '@/assets'
import { NutsDivider } from './nutsDivider'

export function Intro() {
    const inlineStyle = {
        backgroundImage: `url(${PeanutsBG.src})`,
        backgroundSize: '8rem auto',
        backgroundRepeat: 'repeat',
    }

    const lineClass =
        'relative mx-auto w-full items-center space-x-4 md:space-x-6 px-2 md:px-6 lg:px-10 xl:w-[92%] 2xl:w-4/5'
    const textClass = 'text-[9.5vw] md:text-[8vw] font-semibold leading-[0.95]'

    return (
        <Stack className="mt-12 lg:mt-20">
            <Flex className={lineClass}>
                <span className={textClass}>TEXT</span>
                <NutsDivider />
                <span className={textClass}>MONEY</span>
                <motion.img
                    initial={{ opacity: 0, translateY: 20, translateX: 5 }}
                    whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                    transition={{ type: 'spring', damping: 5 }}
                    src={EasySignTight.src}
                    className="hidden h-[7.5vw] w-auto md:block"
                />
            </Flex>

            <Flex className={lineClass}>
                <span className={textClass}>TO</span>
                <motion.img
                    initial={{ opacity: 0, translateY: 24, translateX: -5 }}
                    whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                    transition={{ type: 'spring', damping: 5 }}
                    src={PeaceFingers.src}
                    className="h-[8vw] w-auto -rotate-6"
                />
                <span className={textClass}>YOUR</span>
                <NutsDivider />
                <span className={textClass}>FRENS</span>
            </Flex>

            {/* <Box className="mx-auto mt-12 w-full max-w-4xl px-6 md:mt-20 md:px-8 lg:mt-28">
                <NutsDivider height="h-8" />
            </Box> */}
        </Stack>
    )
}
