'use client'

import { useState } from 'react'
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
            className="bg-gold-3 overflow-x-hidden"
            style={{
                backgroundImage: `url(${assets.PeanutsBG.src})`,
                backgroundSize: '10rem auto',
                backgroundRepeat: 'repeat',
            }}
        >
            <Box className="relative px-6 py-20 md:px-8 md:py-36">
                <img
                    src={assets.StarBlue.src}
                    className="absolute bottom-[3%] left-[7%] w-14 rotate-2 lg:bottom-[4%] lg:left-[10%] xl:bottom-[10%] xl:left-[15%]"
                />

                <Box className="duration-400 relative relative mx-auto max-w-3xl rounded-md border-2 border-n-1 bg-white px-2 py-6 shadow ring-2 ring-white transition-transform hover:rotate-0 md:-rotate-2 md:p-14">
                    <img src={assets.SmilePink.src} className="rotate- absolute -right-16 -top-16 w-28" />
                    <img
                        src={assets.EyesEmoiji.src}
                        className="rotate- absolute -right-16 bottom-12 w-28 xl:-right-20 xl:w-32"
                    />

                    <h2
                        className="font-display border-violet-3 bg-violet-3 absolute -left-6 -top-8
                 rounded-full border-2 px-5 py-3 text-[1.5rem] font-bold uppercase text-white shadow ring-2 ring-white md:text-[2rem]"
                    >
                        {heading}
                    </h2>

                    <Stack spacing={1}>
                        {questions.map((faq, index) => (
                            <Box key={index} className={`px-4 py-4 text-lg font-semibold md:text-xl`}>
                                <Flex justify="space-between" className=" cursor-pointer" onClick={() => setFaq(index)}>
                                    <div className="text-violet-3 uppercase leading-6">{faq.question}</div>
                                    <div className="grow-1 ml-6">
                                        <Icon
                                            name={openFaq === index ? 'minus-circle' : 'plus-circle'}
                                            className="fill-violet-3 h-6 w-6 md:h-8 md:w-8"
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
                </Box>
            </Box>
            {marquee.visible && (
                <Box borderY={'2px solid'} borderColor={'white'} className="shadow">
                    <MarqueeWrapper backgroundColor="bg-cyan-8" direction="left" className="border-y-2 border-n-1 py-2">
                        <div className="font-display mx-2 text-lg uppercase not-italic md:text-xl">
                            {marquee.message}
                        </div>

                        <div className="mx-2">
                            <img src={assets.SmileFinder.src} className="h-auto w-8" />
                        </div>
                    </MarqueeWrapper>
                </Box>
            )}
        </Box>
    )
}
