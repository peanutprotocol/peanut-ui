'use client'

import { useEffect, useRef } from 'react'
import { Stack, Box, Flex, SimpleGrid, GridItem } from '@chakra-ui/react'
import { motion, useAnimation, useInView } from 'framer-motion'
import { FeaturesImages, FeaturesBadgeImage } from './imageAssets'
import { MarqueeWrapper } from '../Global/MarqueeWrapper'
import * as assets from '@/assets'

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
                translateY: 8,
                translateX: 12,
                rotate: 6,
                transition: { duration: 0.4, type: 'spring', damping: 14 },
            },
            hover: {
                opacity: 1,
                translateY: 14,
                translateX: 14,
                rotate: 7,
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
            <Stack spacing={[14, 20, 28, 36]} className="overflow-x-hidden px-6 py-14 sm:py-20 md:px-8 md:py-36">
                {sections.map((section, index) => (
                    <Box key={index} className="relative">
                        <FeaturesImages index={index} />

                        <div className={`relative z-1 mx-auto lg:px-4 xl:w-[92%] 2xl:w-4/5`}>
                            <h2 className="text-center font-display text-2xl font-black uppercase text-n-1">
                                {section.heading}
                            </h2>

                            {section.testimonials && (
                                <SimpleGrid
                                    spacing={8}
                                    columns={{ sm: 1, md: 2, lg: 4 }}
                                    className="mt-12 items-start md:mt-20"
                                >
                                    {section.testimonials.map((testimonial, index) => (
                                        <GridItem key={index}>
                                            <motion.div
                                                ref={ref}
                                                initial="hidden"
                                                // animate="visible"
                                                whileInView="visible"
                                                variants={gridItemVariants[index]}
                                                whileHover="hover"
                                                className={`relative z-10 p-4 md:p-8`}
                                            >
                                                <motion.div
                                                    variants={testimonialBgVariants[index]}
                                                    className={`absolute left-0 top-0 -z-1 h-full w-full rounded-3xl bg-violet-3 testimonial-${index}-bg`}
                                                ></motion.div>

                                                <div
                                                    className={`${testimonial.bgColorClass} absolute left-0 top-0 -z-1 h-full w-full rounded-3xl border-2 border-n-1 bg-white shadow-md ring-2 ring-white`}
                                                ></div>

                                                <img
                                                    src={testimonial.imageSrc}
                                                    alt={testimonial.altText}
                                                    className="mx-auto h-20 w-20 rounded-full"
                                                />

                                                <div className="mt-4 text-center text-lg font-semibold leading-6">
                                                    {testimonial.comment}
                                                </div>

                                                <div className="mt-4 text-center">
                                                    <div className="font-semibold">
                                                        {testimonial.name}, {testimonial.detail}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        </GridItem>
                                    ))}
                                </SimpleGrid>
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
                                                className={`mx-auto flex w-auto rounded-full border-2 border-violet-3 px-5 py-3 font-display text-[1.4rem] font-bold uppercase text-violet-3 shadow ring-2 ring-white md:mr-auto md:text-[2rem] ${index % 2 === 0 ? 'bg-violet-3 text-white' : 'bg-white'}`}
                                            >
                                                {item}
                                            </motion.div>
                                        ))}
                                    </Stack>
                                </Flex>
                            )}
                        </div>

                        {index + 1 < sections.length && (
                            <Box className="mt-16 md:mt-20 lg:mt-28 xl:mt-36">
                                <img src={assets.HR.src} className="mx-auto h-5" />
                            </Box>
                        )}
                    </Box>
                ))}
            </Stack>

            {marquee.visible && (
                <Box borderY={'2px solid'} borderColor={'white'} className="shadow">
                    <MarqueeWrapper backgroundColor="bg-cyan-8" direction="left" className="border-y-2 border-n-1">
                        <div className="mx-3 font-display text-lg uppercase not-italic md:text-xl">
                            {marquee.message}
                        </div>

                        <div className="mx-3 py-2">
                            <img src={assets.HandThumbs.src} className="animation-thumbsUp h-auto w-8" />
                        </div>
                    </MarqueeWrapper>
                </Box>
            )}
        </Flex>
    )
}
