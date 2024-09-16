'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Box, Stack, Flex } from '@chakra-ui/react'
import Icon from '@/components/Global/Icon'
import { PeanutsBG } from '@/assets'

type FAQsProps = {
    heading: string
    questions: Array<{
        question: string
        answer: string
        redirectUrl?: string
        redirectText?: string
        calModal?: boolean
    }>
}

export function FAQsPanel({ heading, questions }: FAQsProps) {
    const [openFaq, setOpenFaq] = useState(-1)

    const setFaq = function (index: number) {
        setOpenFaq(openFaq === index ? -1 : index)
    }

    return (
        <Box
            className="w-full overflow-x-hidden bg-primary"
            style={{
                backgroundImage: `url(${PeanutsBG.src})`,
                backgroundSize: '10rem auto',
                backgroundRepeat: 'repeat',
            }}
        >
            <Box className="relative px-6 py-20 md:px-8 md:py-36">
                <motion.div
                    initial={{ opacity: 1, translateY: 0, translateX: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ type: 'spring', damping: 10 }}
                    className="duration-400 md:-rotate-2- relative relative mx-auto max-w-3xl rounded-md border-2 border-n-1 bg-white px-2 py-6 shadow ring-2 ring-white transition-transform hover:rotate-0 md:p-14"
                >
                    <h2
                        className="absolute -left-6 -top-8 rounded-full border-2 border-n-1
                 bg-primary px-5 py-3 font-display text-[1.5rem] font-bold uppercase text-white shadow ring-2 ring-white md:text-[2rem]"
                    >
                        {heading}
                    </h2>

                    <Stack spacing={1}>
                        {questions.map((faq, index) => (
                            <motion.div
                                animate={{ height: 'auto' }}
                                transition={{ duration: 0.4 }}
                                key={index}
                                className={`px-4 py-4 text-lg font-semibold md:text-xl`}
                            >
                                <Flex
                                    justify="space-between"
                                    className="cursor-pointer items-start"
                                    onClick={() => setFaq(index)}
                                >
                                    <div className="uppercase leading-6 text-accent">{faq.question}</div>

                                    <motion.div
                                        className="grow-1 ml-6"
                                        animate={{ rotate: openFaq === index ? 180 : 0 }}
                                        transition={{ duration: 0.3, transitionOrigin: 'center' }}
                                    >
                                        <Icon
                                            name={openFaq === index ? 'minus-circle' : 'plus-circle'}
                                            className="h-6 w-6 fill-accent md:h-8 md:w-8"
                                        />
                                    </motion.div>
                                </Flex>

                                <AnimatePresence initial={false}>
                                    {openFaq == index && (
                                        <motion.p
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="mt-1 overflow-hidden leading-6 text-n-1"
                                        >
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
                                                <a
                                                    href={faq.redirectUrl}
                                                    target="_blank"
                                                    className="text-black underline"
                                                >
                                                    {faq.redirectText}
                                                </a>
                                            )}
                                        </motion.p>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        ))}
                    </Stack>
                </motion.div>
            </Box>
        </Box>
    )
}
