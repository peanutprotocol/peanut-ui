'use client'

import { useState } from 'react'
import { Box } from '@chakra-ui/react'
import { MarqueeComp } from '@/components/Global/MarqueeWrapper'
import { PeanutsBG, Eyes } from '@/assets'
import { FAQsPanel, FAQsProps } from '../Global/FAQs'

type LocalFAQsProps = FAQsProps & {
    marquee: {
        visible: boolean
        message?: string
    }
}

export function FAQs({ heading, questions, marquee = { visible: false } }: LocalFAQsProps) {
    const [openFaq, setOpenFaq] = useState(-1)

    const setFaq = function (index: number) {
        setOpenFaq(openFaq === index ? -1 : index)
    }

    return (
        <Box
            className="overflow-x-hidden bg-primary"
            style={{
                backgroundImage: `url(${PeanutsBG.src})`,
                backgroundSize: '10rem auto',
                backgroundRepeat: 'repeat',
            }}
        >
            <FAQsPanel heading={heading} questions={questions} />

            {marquee.visible && (
                <MarqueeComp message={marquee.message} imageSrc={Eyes.src} imageAnimationClass="animation-rock" />
            )}
        </Box>
    )
}
