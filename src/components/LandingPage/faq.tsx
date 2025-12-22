'use client'

import { Eyes, PeanutsBG } from '@/assets'
import { MarqueeComp } from '@/components/Global/MarqueeWrapper'
import { Box } from '@chakra-ui/react'
import { FAQsPanel, type FAQsProps } from '../Global/FAQs'

type LocalFAQsProps = FAQsProps & {
    marquee: {
        visible: boolean
        message?: string
    }
}

export function FAQs({ heading, questions, marquee = { visible: false } }: LocalFAQsProps) {
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
