'use client'

import { useState } from 'react'
import { CarouselDots } from '@/components/0_Bruddle/CarouselDots'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'

export default function CarouselDotsPage() {
    const [active, setActive] = useState(1)

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
        </DocPage>
    )
}
