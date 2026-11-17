'use client'

import { useState } from 'react'
import { CarouselDots } from '@/components/0_Bruddle/CarouselDots'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'
import { ProductUsage } from '../../_components/ProductUsage'
import { WhenToUse } from '../../_components/WhenToUse'

export default function CarouselDotsPage() {
    const [active, setActive] = useState(1)
    // the embla carousel below drives its dots from the selected snap
    const [slide, setSlide] = useState(0)

    return (
        <DocPage>
            <DocHeader
                title="CarouselDots"
                description="Dot pagination and THE stepper, from the dots/stepper board (17312:137591): active = 24x8 border-default bar, inactive = 8px border-subtle dot. One style for carousel pages and flow steps. onSelect makes each dot a 44px-hit-area button."
                status="production"
            />

            <WhenToUse
                use={[
                    'Page position in a swipeable carousel — the shared embla wrapper renders it',
                    'Step position in a stepped flow — this is the stepper (card add-to-wallet, paperwork verification questions)',
                    'Let the user jump to a page: pass onSelect and each dot becomes a button with a 44px hit area',
                    'Read-only indicator: omit onSelect and pass aria-label with the current step and the total',
                ]}
                dontUse={[
                    'Percentage or quantity progress — use ProgressBar',
                    'Switching between named sections — use Tabs',
                    'A single page — show the dots only above one snap',
                    "Outlined/filled 'done' dots — rejected 17 Nov 2026, keep one stepper style",
                ]}
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

            <DocSection title="Stepper">
                <DocSection.Content>
                    <div className="flex flex-col items-start gap-4">
                        <CarouselDots count={4} activeIndex={1} aria-label="Step 2 of 4" />
                        <p className="text-body-s text-foreground-secondary">
                            One style for paging and steps. No done/filled state and no outlined variant: steps behind
                            and ahead look the same, only the current one is the pill. A read-only stepper omits
                            onSelect and passes aria-label with the current step and the total, which gives the dots
                            role=group. Decided 17 Nov 2026.
                        </p>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Read-only stepper"
                        code={`<CarouselDots count={4} activeIndex={1} aria-label="Step 2 of 4" />`}
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

                <ProductUsage.Example
                    title="Paperwork verification — question screens"
                    path="src/features/paperwork-verification/components/VerifyLayout.tsx"
                    description="The stepper in the verification top bar (VerifyQuestionLayout and IdentityDocumentScreen). Replaced the black ProgressBar 'Step n of m'; read-only, so aria-label carries the position."
                    code={`<CarouselDots
    count={progress.total}
    activeIndex={Math.max(0, Math.min(progress.current - 1, progress.total - 1))}
    aria-label={t('progress', progress)}
    className="justify-center"
/>`}
                >
                    <CarouselDots count={5} activeIndex={2} aria-label="Step 3 of 5" />
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
