'use client'

import { useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { Calendar } from '@/components/0_Bruddle/Calendar'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'
import { ProductUsage } from '../../_components/ProductUsage'
import { WhenToUse } from '../../_components/WhenToUse'

export default function CalendarPage() {
    const [range, setRange] = useState<DateRange | undefined>(undefined)
    // the product recreation below starts on a finished range so the selection look shows
    const [statementRange, setStatementRange] = useState<DateRange | undefined>({
        from: new Date(2026, 7, 3),
        to: new Date(2026, 7, 14),
    })

    return (
        <DocPage>
            <DocHeader
                title="Calendar"
                description="Range calendar over react-day-picker, semantic tokens only. Day cells are 44px (touch-target law); future days are unselectable. Ordered 2026-09-15 for the statement period on Profile → Statements."
                status="limited"
            />

            <WhenToUse
                use={[
                    'Picking a date range, on a form page or in a drawer — the first tap sets the start, the second the end',
                    'A range that ends today or earlier — days after today are unselectable',
                    'A calendar that opens under the field it fills, so the page grows and the CTA moves down with it',
                ]}
                dontUse={[
                    'A single preset choice such as "Last 30 days" — use BaseSelect',
                    'Future dates — the calendar cannot select them',
                ]}
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

            <ProductUsage>
                <ProductUsage.Example
                    title="Profile — Statements, custom period"
                    path="src/features/statements/StatementsPage.tsx"
                    description="Choosing Custom period under the Period field opens the calendar on the page, not in a drawer. The chosen days feed the file the Download button saves."
                    code={`{period.isCustom && (
    <Calendar selected={days} onSelect={period.selectDays} defaultMonth={days?.from} />
)}`}
                >
                    <div className="max-w-xs">
                        <Calendar
                            selected={statementRange}
                            onSelect={setStatementRange}
                            defaultMonth={statementRange?.from}
                        />
                    </div>
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
