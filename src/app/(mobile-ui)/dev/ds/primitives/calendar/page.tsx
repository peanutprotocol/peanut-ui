'use client'

import { useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { Calendar } from '@/components/0_Bruddle/Calendar'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'

export default function CalendarPage() {
    const [range, setRange] = useState<DateRange | undefined>(undefined)

    return (
        <DocPage>
            <DocHeader
                title="Calendar"
                description="Range calendar over react-day-picker, semantic tokens only. Day cells are 44px (touch-target law); future days are unselectable. code-only ❓ — a figma board is owed via the figma-first flow (ordered for the activity-history timeframe filter, 2026-09-15)."
                status="limited"
            />

            <DocSection title="Range selection">
                <DocSection.Content>
                    <div className="max-w-[343px]">
                        <Calendar selected={range} onSelect={setRange} />
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Calendar"
                        code={`import { Calendar } from '@/components/0_Bruddle/Calendar'

<Calendar selected={range} onSelect={setRange} />`}
                    />
                </DocSection.Code>
            </DocSection>
        </DocPage>
    )
}
