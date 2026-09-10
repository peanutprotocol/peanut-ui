'use client'

import { useState } from 'react'
import { Accordion } from '@/components/0_Bruddle/Accordion'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { PropsTable } from '../../_components/PropsTable'
import { CodeBlock } from '../../_components/CodeBlock'

export default function AccordionPage() {
    const [value, setValue] = useState<string>('expanded')

    return (
        <DocPage>
            <DocHeader
                title="Accordion"
                description="From the figma accordion board (17802:61540), radix headless base. Users scan section titles and expand only what they need. Consumer: BridgeLimitsView (limits QR countries)."
                status="production"
            />

            <DocSection title="States">
                <DocSection.Content>
                    <Accordion type="single" collapsible value={value} onValueChange={setValue}>
                        <Accordion.Item value="collapsed">
                            <Accordion.Trigger>Collapsed accordion header</Accordion.Trigger>
                            <Accordion.Content>
                                Content goes here. This area can hold any component or text style.
                            </Accordion.Content>
                        </Accordion.Item>
                        <Accordion.Item value="expanded">
                            <Accordion.Trigger>Expanded accordion header</Accordion.Trigger>
                            <Accordion.Content>
                                Content goes here. This area can hold any component or text style. Longer text has more
                                place under it.
                            </Accordion.Content>
                        </Accordion.Item>
                        <Accordion.Item value="disabled" disabled>
                            <Accordion.Trigger>Disabled accordion header</Accordion.Trigger>
                            <Accordion.Content>Never shown.</Accordion.Content>
                        </Accordion.Item>
                    </Accordion>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Accordion"
                        code={`import { Accordion } from '@/components/0_Bruddle/Accordion'

<Accordion type="single" collapsible value={open} onValueChange={setOpen}>
    <Accordion.Item value="ar">
        <Accordion.Trigger>Argentina</Accordion.Trigger>
        <Accordion.Content>Pay up to $500 per QR payment.</Accordion.Content>
    </Accordion.Item>
    <Accordion.Item value="br" disabled>
        <Accordion.Trigger>Brazil</Accordion.Trigger>
        <Accordion.Content>Coming soon.</Accordion.Content>
    </Accordion.Item>
</Accordion>`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <PropsTable
                rows={[
                    {
                        name: 'Accordion',
                        type: 'radix Root props',
                        default: '—',
                        description: 'type="single" collapsible + value/onValueChange, or type="multiple"',
                    },
                    {
                        name: 'Accordion.Item',
                        type: 'radix Item props',
                        default: '—',
                        description: 'value (required), disabled',
                    },
                    {
                        name: 'Accordion.Trigger',
                        type: 'radix Trigger props',
                        default: '—',
                        description: 'Header row; chevron is built in',
                    },
                    {
                        name: 'Accordion.Content',
                        type: 'radix Content props',
                        default: '—',
                        description: 'Divider + padded body, animated',
                    },
                ]}
            />
        </DocPage>
    )
}
