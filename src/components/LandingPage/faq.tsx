import Eyes from '@/assets/illustrations/eyes.svg'
import { MarqueeComp } from '@/components/Global/MarqueeWrapper'
import { FAQsPanel, type FAQsProps } from '../Global/FAQs'

type LocalFAQsProps = FAQsProps & {
    marquee: {
        visible: boolean
        message?: string
    }
}

export function FAQs({ heading, questions, learnMoreLabel, marquee = { visible: false } }: LocalFAQsProps) {
    return (
        // no background here: FAQsPanel paints its own opaque full-width one on
        // top, and bg-secondary had no --color-secondary token to resolve.
        <div id="faq" className="overflow-x-hidden">
            <FAQsPanel heading={heading} questions={questions} learnMoreLabel={learnMoreLabel} />

            {marquee.visible && (
                <MarqueeComp
                    message={marquee.message}
                    imageSrc={Eyes.src}
                    imageAnimationClass="animation-rock"
                    backgroundColor="bg-yellow-500"
                />
            )}
        </div>
    )
}
