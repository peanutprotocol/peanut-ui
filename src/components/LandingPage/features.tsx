'use client'

import { HandThumbsUp } from '@/assets'
import * as chain_logos from '@/assets/chains'
import { Box, Flex, Stack, useMediaQuery } from '@chakra-ui/react'
import { motion } from 'framer-motion'
import { useRef } from 'react'
import { MarqueeComp, MarqueeWrapper } from '../Global/MarqueeWrapper'
import { Testimonials } from '../Global/Testimonials'
import { FeaturesBadgeImage, FeaturesImages } from './imageAssets'

type FeaturesProps = {
    sections: Array<{
        heading: string
        list?: Array<string>
        testimonials?: Array<{
            imageSrc: string
            altText: string
            comment: string
            name: string
            detail: string
            detailRedirectUrl?: string
            bgColorClass: string
        }>
    }>
    marquee: {
        visible: boolean
        message?: string
    }
}

export function Features({ sections, marquee = { visible: false } }: FeaturesProps) {
    const ref = useRef(null)
    const [isLargerThan768] = useMediaQuery('(min-width: 768px)')

    // Animation variants
    const gridItemVariants = [
        {
            hidden: { opacity: 0, translateY: 20, translateX: 0, rotate: 0 },
            visible: {
                opacity: 1,
                translateY: 0,
                translateX: 0,
                rotate: 0.25,
                transition: { duration: 0.4, type: 'spring', damping: 14 },
            },
            hover: {
                opacity: 1,
                translateY: -8,
                translateX: -3,
                rotate: 2,
                transition: { duration: 0.4, type: 'spring', damping: 14 },
            },
        },
        {
            hidden: { opacity: 0, translateY: 20, rotate: 0 },
            visible: {
                opacity: 1,
                translateY: 28,
                translateX: 0,
                rotate: -0.15,
                transition: { duration: 0.4, type: 'spring', damping: 14 },
            },
            hover: {
                opacity: 1,
                translateY: 14,
                translateX: -5,
                rotate: -2,
                transition: { duration: 0.4, type: 'spring', damping: 14 },
            },
        },
        {
            hidden: { opacity: 0, translateY: 20, rotate: 0 },
            visible: {
                opacity: 1,
                translateY: 2,
                translateX: 0,
                rotate: -0.05,
                transition: { duration: 0.4, type: 'spring', damping: 14 },
            },
            hover: {
                opacity: 1,
                translateY: -12,
                translateX: -6,
                rotate: -2,
                transition: { duration: 0.4, type: 'spring', damping: 14 },
            },
        },
        {
            hidden: { opacity: 0, translateY: 20, rotate: 0 },
            visible: {
                opacity: 1,
                translateY: 38,
                translateX: 2,
                rotate: 0.05,
                transition: { duration: 0.4, type: 'spring', damping: 14 },
            },
            hover: {
                opacity: 1,
                translateY: 46,
                translateX: 2,
                rotate: -2,
                transition: { duration: 0.4, type: 'spring', damping: 14 },
            },
        },
    ]

    const testimonialBgVariants = [
        {
            hidden: { opacity: 0, translateY: 0, translateX: 0, rotate: 0 },
            visible: {
                opacity: 1,
                translateY: 1.5,
                translateX: -1,
                rotate: -6,
                transition: { duration: 0.4, type: 'spring', damping: 14 },
            },
            hover: {
                opacity: 1,
                translateY: 3,
                translateX: -3,
                rotate: -8,
                transition: { duration: 0.4, type: 'spring', damping: 14 },
            },
        },
        {
            hidden: { opacity: 0, translateY: 0, translateX: 0, rotate: 0 },
            visible: {
                opacity: 1,
                translateY: 1.3,
                translateX: 1.6,
                rotate: 4,
                transition: { duration: 0.4, type: 'spring', damping: 14 },
            },
            hover: {
                opacity: 1,
                translateY: 8,
                translateX: 5,
                rotate: 6,
                transition: { duration: 0.4, type: 'spring', damping: 14 },
            },
        },
        {
            hidden: { opacity: 0, translateY: 0, translateX: 0, rotate: 0 },
            visible: {
                opacity: 1,
                translateY: 6,
                translateX: 10,
                rotate: 4,
                transition: { duration: 0.4, type: 'spring', damping: 14 },
            },
            hover: {
                opacity: 1,
                translateY: 12,
                translateX: 12,
                rotate: 5,
                transition: { duration: 0.4, type: 'spring', damping: 14 },
            },
        },
        {
            hidden: { opacity: 0, translateY: 0, translateX: 0, rotate: 0 },
            visible: {
                opacity: 1,
                translateY: -0.5,
                translateX: 0.5,
                rotate: -4,
                transition: { duration: 0.4, type: 'spring', damping: 14 },
            },
            hover: {
                opacity: 1,
                translateY: -5.5,
                translateX: 3.5,
                rotate: -5,
                transition: { duration: 0.4, type: 'spring', damping: 14 },
            },
        },
    ]

    return (
        <Flex direction={'column'} width={'100%'}>
            <Stack spacing={[14, 20, 28]} className="overflow-hidden py-14 md:py-20">
                {sections.map((section, index) => (
                    <Box key={index} className="relative">
                        <FeaturesImages index={index} />

                        <div className={`relative z-1 mx-auto px-6 md:px-8 lg:px-4 xl:w-[92%] 2xl:w-4/5`}>
                            <h2 className="text-center text-5xl font-black font-bold uppercase text-n-1">
                                {section.heading}
                            </h2>

                            {section.testimonials && (
                                <div className="mt-12 md:mt-20">
                                    <Testimonials testimonials={section.testimonials} />
                                </div>
                            )}

                            {section.list && (
                                <Flex className="mt-12" gap={4} wrap={'wrap'}>
                                    <FeaturesBadgeImage />

                                    <Stack spacing={4} className="mx-auto mt-12 flex text-center md:text-left lg:mt-0">
                                        {section.list.map((item, index) => (
                                            <motion.div
                                                initial={{
                                                    opacity: 0,
                                                    translateY: 32,
                                                    translateX: index % 2 === 0 ? -8 : 8,
                                                    rotate: 4,
                                                    transformOrigin: 'bottom right',
                                                }}
                                                whileInView={{
                                                    opacity: 1,
                                                    translateY: 0,
                                                    translateX: 0,
                                                    rotate: 0,
                                                    transformOrigin: 'bottom right',
                                                }}
                                                whileHover={{
                                                    translateY: 8,
                                                    translateX: 3,
                                                    rotate: 0.75,
                                                    transformOrigin: 'bottom right',
                                                }}
                                                transition={{ type: 'spring', damping: 15 }}
                                                key={index}
                                                className={`feature ${index % 2 === 0 ? 'feature-secondary' : ''}`}
                                            >
                                                {item}
                                            </motion.div>
                                        ))}
                                    </Stack>
                                </Flex>
                            )}
                        </div>

                        {index + 1 < sections.length && (
                            // <Box className="mt-16 md:mt-20 lg:mt-28 xl:mt-36">
                            //     <img src={HR.src} className="mx-auto h-5" />
                            // </Box>

                            <div className="mt-16 md:mt-28 lg:mt-36">
                                <MarqueeWrapper backgroundColor="bg-transparent" direction="right" className="">
                                    {Object.entries(chain_logos).map(([chain, logo]) => {
                                        return (
                                            <div className="pl-3" key={chain}>
                                                <img
                                                    loading="eager"
                                                    src={logo.src}
                                                    className="h-16 w-16"
                                                    alt={`${chain} Logo`}
                                                />
                                            </div>
                                        )
                                    })}
                                </MarqueeWrapper>
                            </div>
                        )}
                    </Box>
                ))}
            </Stack>

            {marquee.visible && (
                <MarqueeComp message={marquee.message} imageSrc={HandThumbsUp.src} backgroundColor="bg-secondary-1" />
            )}
        </Flex>
    )
}
