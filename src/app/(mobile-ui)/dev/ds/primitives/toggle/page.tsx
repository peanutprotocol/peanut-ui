'use client'

import { useState } from 'react'
import { Toggle } from '@/components/0_Bruddle/Toggle'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { PropsTable } from '../../_components/PropsTable'
import { CodeBlock } from '../../_components/CodeBlock'

export default function TogglePage() {
    const [on, setOn] = useState(true)
    const [off, setOff] = useState(false)

    return (
        <DocPage>
            <DocHeader
                title="Toggle"
                description="Switch from the figma toggle board (17802:61532). Monochrome: black knob on, outlined knob off."
                status="production"
            />

            <DocSection title="Values & States">
                <DocSection.Content>
                    <div className="flex items-center gap-6">
                        <Toggle checked={on} onChange={setOn} aria-label="demo on" />
                        <Toggle checked={off} onChange={setOff} aria-label="demo off" />
                        <Toggle checked={true} onChange={() => {}} disabled aria-label="demo disabled on" />
                        <Toggle checked={false} onChange={() => {}} disabled aria-label="demo disabled off" />
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Toggle"
                        code={`import { Toggle } from '@/components/0_Bruddle/Toggle'

<Toggle checked={enabled} onChange={setEnabled} aria-label="Show full name" />`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <PropsTable
                rows={[
                    { name: 'checked', type: 'boolean', default: '(required)' },
                    { name: 'onChange', type: '(checked: boolean) => void', default: '(required)' },
                    { name: 'disabled', type: 'boolean', default: 'false', description: '40% opacity, no clicks' },
                    {
                        name: 'aria-label',
                        type: 'string',
                        default: '(none)',
                        description: 'Required when no visible label',
                    },
                ]}
            />
        </DocPage>
    )
}
