'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Box, Stack, Flex } from '@chakra-ui/react'
import Icon from '@/components/Global/Icon'
import { MarqueeWrapper } from '@/components/Global/MarqueeWrapper'
import * as assets from '@/assets'

type FAQsProps = {
    heading: string
    questions: Array<{
        question: string
        answer: string
        redirectUrl?: string
        redirectText?: string
        calModal?: boolean
    }>
    marquee: {
        visible: boolean
        message?: string
    }
}

export function FAQs({ heading, questions, marquee = { visible: false } }: FAQsProps) {
    const [openFaq, setOpenFaq] = useState(-1)

    const setFaq = function (index: number) {
        setOpenFaq(openFaq === index ? -1 : index)
    }

    return (
        <Box
            className="overflow-x-hidden bg-gold-3"
            style={{
                backgroundImage: `url(${assets.PeanutsBG.src})`,
                backgroundSize: '10rem auto',
                backgroundRepeat: 'repeat',
            }}
        >
            <Box className="relative px-6 py-20 md:px-8 md:py-36">
                <motion.img
                    initial={{ opacity: 0, translateY: 18, translateX: 5 }}
                    whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                    whileHover={{ scale: 1.15, translateY: 1, translateX: -2, rotate: -2 }}
                    transition={{ type: 'spring', damping: 6 }}
                    src={assets.StarBlue.src}
                    className="absolute bottom-[3%] left-[7%] w-14 rotate-2 lg:bottom-[4%] lg:left-[10%] xl:bottom-[10%] xl:left-[15%]"
                />

                <motion.div
                    initial={{ opacity: 1, rotate: 0, translateY: 0, translateX: 0 }}
                    whileInView={{ opacity: 1, rotate: 3 }}
                    whileHover={{ rotate: 0 }}
                    transition={{ type: 'spring', damping: 10 }}
                    className="duration-400 md:-rotate-2- relative relative mx-auto max-w-3xl rounded-md border-2 border-n-1 bg-white px-2 py-6 shadow ring-2 ring-white transition-transform hover:rotate-0 md:p-14"
                >
                    <motion.img
                        initial={{ opacity: 0, translateY: 18, translateX: 5 }}
                        whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                        whileHover={{ scale: 1.15, translateY: 1, translateX: 2, rotate: 2 }}
                        transition={{ type: 'spring', damping: 6 }}
                        src={assets.SmilePink.src}
                        className="rotate- absolute -right-16 -top-16 w-28"
                    />
                    <motion.img
                        initial={{ opacity: 0, translateY: 18, translateX: 5 }}
                        whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                        whileHover={{ scale: 1.15, translateY: 1, translateX: -2, rotate: -2 }}
                        transition={{ type: 'spring', damping: 6 }}
                        src={assets.EyesEmoiji.src}
                        className="rotate- absolute -right-16 bottom-12 w-28 xl:-right-20 xl:w-32"
                    />

                    <h2
                        className="absolute -left-6 -top-8 rounded-full border-2 border-violet-3
                 bg-violet-3 px-5 py-3 font-display text-[1.5rem] font-bold uppercase text-white shadow ring-2 ring-white md:text-[2rem]"
                    >
                        {heading}
                    </h2>

                    <Stack spacing={1}>
                        {questions.map((faq, index) => (
                            <Box key={index} className={`px-4 py-4 text-lg font-semibold md:text-xl`}>
                                <Flex justify="space-between" className=" cursor-pointer" onClick={() => setFaq(index)}>
                                    <div className="uppercase leading-6 text-violet-3">{faq.question}</div>
                                    <div className="grow-1 ml-6">
                                        <Icon
                                            name={openFaq === index ? 'minus-circle' : 'plus-circle'}
                                            className="h-6 w-6 fill-violet-3 md:h-8 md:w-8"
                                        />
                                    </div>
                                </Flex>

                                {openFaq == index && (
                                    <p className="mt-1 leading-6 text-n-1">
                                        {faq.answer}
                                        {faq.calModal && (
                                            <a
                                                data-cal-link="kkonrad+hugo0/15min?duration=30"
                                                data-cal-config='{"layout":"month_view"}'
                                                className=" underline"
                                            >
                                                Let's talk!
                                            </a>
                                        )}
                                        {faq.redirectUrl && (
                                            <a href={faq.redirectUrl} target="_blank" className="text-black underline">
                                                {faq.redirectText}
                                            </a>
                                        )}
                                    </p>
                                )}
                            </Box>
                        ))}
                    </Stack>
                </motion.div>
            </Box>
            {marquee.visible && (
                <Box borderY={'2px solid'} borderColor={'white'} className="shadow">
                    <MarqueeWrapper backgroundColor="bg-cyan-8" direction="left" className="border-y-2 border-n-1 py-1">
                        <div className="mx-2 font-display text-lg uppercase not-italic md:text-xl">
                            {marquee.message}
                        </div>

                        <div className="mx-2">
                            <img src={assets.SmileStars.src} className="animation-faceSpin h-auto w-9" />
                        </div>
                    </MarqueeWrapper>
                </Box>
            )}
        </Box>
    )
}
