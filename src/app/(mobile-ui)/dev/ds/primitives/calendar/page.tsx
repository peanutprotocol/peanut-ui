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
                    <div className="flex max-w-[343px] flex-col gap-4">
                        <Calendar selected={range} onSelect={setRange} />
                        <ul className="flex flex-col gap-1 text-body-xs text-foreground-secondary">
                            <li>Tap: first tap sets the start, second sets the end, in either order.</li>
                            <li>A tap on a finished range starts a new one. Tapping a single-day range clears it.</li>
                            <li>Drag: press a day and slide; the range follows the finger and commits on release.</li>
                            <li>Haptics: heavy on press and on the release of a drag, light per day crossed.</li>
                        </ul>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Calendar"
                        code={`import { Calendar } from '@/components/0_Bruddle/Calendar'

// selected is controlled; onSelect only receives committed ranges —
// a drag in progress previews inside the calendar and reports on release
<Calendar selected={range} onSelect={setRange} />`}
                    />
                </DocSection.Code>
            </DocSection>
        </DocPage>
    )
}
