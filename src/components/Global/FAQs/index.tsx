'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Box, Stack, Flex } from '@chakra-ui/react'
import dynamic from 'next/dynamic'
import { PeanutsBG } from '@/assets'

// Dynamically import Icon for lazy loading
const Icon = dynamic(() => import('@/components/Global/Icon'), {
    loading: () => <span>...</span>,
})

export type FAQsProps = {
    heading: string
    questions: Array<{
        id: string // Added unique identifier
        question: string
        answer: string
        redirectUrl?: string
        redirectText?: string
        calModal?: boolean
    }>
}

export function FAQsPanel({ heading, questions }: FAQsProps) {
    const [openFaq, setOpenFaq] = useState<string | null>(null)

    const setFaq = useCallback((id: string) => {
        setOpenFaq((prevId) => (prevId === id ? null : id))
    }, [])

    return (
        <Box className="w-full overflow-x-hidden bg-background">
            <Box className="relative px-6 py-20 md:px-8 md:py-36">
                <motion.div
                    initial={{ opacity: 0, translateY: 20 }} // Added entry animation
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'spring', damping: 10 }}
                    className="relative mx-auto max-w-3xl rounded-md border-2 border-n-1 bg-white px-2 py-6 shadow ring-2 ring-white transition-transform duration-300 hover:rotate-0 md:-rotate-2 md:p-14"
                >
                    <h2 className="bg-primary absolute -left-2 -top-8 rounded-full border-2 border-n-1 px-5 py-3 font-display text-[1.5rem] font-bold text-white shadow ring-2 ring-white sm:-left-6 md:text-[2rem]">
                        {heading}
                    </h2>

                    <Stack spacing={1}>
                        {questions.map((faq) => (
                            <motion.div
                                animate={{ height: 'auto' }}
                                transition={{ duration: 0.4 }}
                                key={faq.id} // Use unique id
                                className="px-4 py-4 text-lg font-semibold md:text-xl"
                            >
                                <Flex
                                    as="button"
                                    type="button"
                                    justify="space-between"
                                    className="w-full cursor-pointer items-start text-left focus:outline-none"
                                    onClick={() => setFaq(faq.id)}
                                    aria-expanded={openFaq === faq.id}
                                    aria-controls={`faq-answer-${faq.id}`}
                                >
                                    <div className="grow uppercase leading-6 text-accent">{faq.question}</div>

                                    <motion.div
                                        className="-mt-1.5 ml-6"
                                        animate={{ rotate: openFaq === faq.id ? 180 : 0 }}
                                        transition={{ duration: 0.3, transformOrigin: 'center' }}
                                    >
                                        <Icon
                                            name={openFaq === faq.id ? 'minus-circle' : 'plus-circle'}
                                            className="h-6 w-6 fill-accent md:h-8 md:w-8"
                                        />
                                    </motion.div>
                                </Flex>

                                <AnimatePresence initial={false}>
                                    {openFaq === faq.id && (
                                        <motion.p
                                            id={`faq-answer-${faq.id}`}
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
                                                    className="underline"
                                                >
                                                    Let's talk!
                                                </a>
                                            )}
                                            {faq.redirectUrl && faq.redirectText && (
                                                <a
                                                    href={faq.redirectUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
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
