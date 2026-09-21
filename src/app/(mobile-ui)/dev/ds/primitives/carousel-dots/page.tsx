'use client'

import { useState } from 'react'
import { CarouselDots } from '@/components/0_Bruddle/CarouselDots'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'
import { ProductUsage } from '../../_components/ProductUsage'

export default function CarouselDotsPage() {
    const [active, setActive] = useState(1)
    // the embla carousel below drives its dots from the selected snap
    const [slide, setSlide] = useState(0)

    return (
        <DocPage>
            <DocHeader
                title="CarouselDots"
                description="Dot pagination from the dots/stepper board (17312:137591): active = 24x8 border-default bar, inactive = 8px border-subtle dot. onSelect makes each dot a 44px-hit-area button."
                status="production"
            />

            <DocSection title="Interactive">
                <DocSection.Content>
                    <div className="flex flex-col items-start gap-4">
                        <CarouselDots count={4} activeIndex={active} onSelect={setActive} />
                        <CarouselDots count={3} activeIndex={0} />
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="CarouselDots"
                        code={`import { CarouselDots } from '@/components/0_Bruddle/CarouselDots'

<CarouselDots count={4} activeIndex={page} onSelect={setPage} />`}
                    />
                </DocSection.Code>
            </DocSection>

            <ProductUsage>
                <ProductUsage.Example
                    title="Global carousel"
                    path="src/components/Global/Carousel/index.tsx"
                    description="The shared embla wrapper. Dots are clickable and only render when there is more than one snap."
                    code={`{scrollSnaps.length > 1 && (
    <CarouselDots count={scrollSnaps.length} activeIndex={selectedIndex} onSelect={onDotButtonClick} />
)}`}
                >
                    <CarouselDots count={3} activeIndex={slide} onSelect={setSlide} />
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Card — add to wallet steps"
                    path="src/components/Card/AddToWalletCarousel.tsx"
                    description="Read-only step indicator: the user advances with the button below, so the dots carry an aria-label instead of onSelect."
                    code={`<CarouselDots
    count={steps.length}
    activeIndex={index}
    aria-label={t('addToWallet.stepIndicator', { current: index + 1, total: steps.length })}
/>`}
                >
                    <CarouselDots count={3} activeIndex={1} aria-label="Step 2 of 3" />
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
