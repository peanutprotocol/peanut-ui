'use client'

import { Eyes, PeanutsBG } from '@/assets'
import { MarqueeComp } from '@/components/Global/MarqueeWrapper'
import { Box } from '@chakra-ui/react'
import { useState } from 'react'
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
            className="bg-secondary overflow-x-hidden"
            style={{
                backgroundImage: `url(${PeanutsBG.src})`,
                backgroundSize: '10rem auto',
                backgroundRepeat: 'repeat',
            }}
        >
            <FAQsPanel heading={heading} questions={questions} />

            {marquee.visible && (
                <MarqueeComp
                    message={marquee.message}
                    imageSrc={Eyes.src}
                    imageAnimationClass="animation-rock"
                    backgroundColor="bg-secondary-1"
                />
            )}
        </Box>
    )
}
