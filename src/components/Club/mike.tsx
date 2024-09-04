'use client'

import { Stack } from '@chakra-ui/react'
import { motion } from 'framer-motion'
import * as assets from '@/assets'
import { AutoTextSize } from 'auto-text-size'

type MikeProps = {
    lines: Array<string>
}

export function Mike({ lines }: MikeProps) {
    return (
        <Stack className="relative overflow-x-hidden px-6 py-40 md:px-8 md:py-36">
            <motion.img
                initial={{ opacity: 0, translateY: 12, translateX: -5 }}
                whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                // whileHover={{ scale: 1.15, translateY: -1, translateX: -2, rotate: 3 }}
                transition={{ type: 'spring', damping: 6 }}
                src={assets.Star.src}
                className="absolute left-0 top-[12%] w-14 md:left-[4%] lg:left-[10%]"
            />
            <motion.img
                initial={{ opacity: 0, translateY: 12, translateX: 5 }}
                whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                // whileHover={{ scale: 1.15, translateY: 1, translateX: 2, rotate: 2 }}
                transition={{ type: 'spring', damping: 6 }}
                src={assets.SmileSide.src}
                className="absolute right-4 top-[14%] w-30 -rotate-[15deg] md:right-[4%] lg:right-[12%]"
            />
            <motion.img
                initial={{ opacity: 0, translateY: 18, translateX: 8 }}
                whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                // whileHover={{ scale: 1.15, translateY: 1, translateX: 2, rotate: 2 }}
                transition={{ type: 'spring', damping: 6 }}
                src={assets.SmileStars.src}
                className="absolute -right-8 top-[4%] w-32 rotate-2 md:right-[1%] lg:right-[9%]"
            />

            {lines.map((line, index) => (
                <motion.div
                    initial={{ opacity: 0, translateY: 32, translateX: index % 2 === 0 ? -8 : 8, rotate: 4 }}
                    whileInView={{ opacity: 1, translateY: 0, translateX: 0, rotate: 0 }}
                    whileHover={{ translateY: 6, translateX: 2, rotate: 2 }}
                    transition={{ type: 'spring', damping: 6 }}
                    key={index}
                    className={`text-violet-3- relative z-10 mx-auto w-4/5 max-w-4xl text-center font-display uppercase leading-[0.825]`}
                >
                    <AutoTextSize maxFontSizePx={400}>{line}</AutoTextSize>
                </motion.div>
            ))}
        </Stack>
    )
}
