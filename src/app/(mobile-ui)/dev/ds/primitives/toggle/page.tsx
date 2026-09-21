'use client'

import { useState } from 'react'
import { Toggle } from '@/components/0_Bruddle/Toggle'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { PropsTable } from '../../_components/PropsTable'
import { CodeBlock } from '../../_components/CodeBlock'
import { ProductUsage } from '../../_components/ProductUsage'

export default function TogglePage() {
    const [on, setOn] = useState(true)
    const [off, setOff] = useState(false)
    // one piece of local state per product recreation below
    const [showFullName, setShowFullName] = useState(false)
    const [shareBankInstructions, setShareBankInstructions] = useState(true)

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
                        code={`import { useState } from 'react'
import { Toggle } from '@/components/0_Bruddle/Toggle'

const [enabled, setEnabled] = useState(false)

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

            <ProductUsage>
                <ProductUsage.Example
                    title="Profile — show my full name"
                    path="src/components/Profile/components/ShowNameToggle.tsx"
                    description="Trailing control on a settings row. Turning it on opens a confirm modal first; turning it off saves straight away."
                    code={`<Toggle checked={checked} onChange={handleToggleChange} aria-label={t('menu.showMyFullName')} />`}
                >
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-body-s text-foreground-primary">Show my full name</span>
                        <Toggle checked={showFullName} onChange={setShowFullName} aria-label="Show my full name" />
                    </div>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Request link — share bank instructions"
                    path="src/components/Request/link/views/BankInstructionsToggle.tsx"
                    description="Sits in the trailing slot of a list row. The aria-label stays the same in both states so it never reads as a double negative."
                    code={`<Toggle
    checked={checked}
    onChange={onChange}
    disabled={disabled}
    // One stable name. A label that flips with the state reads as
    // "Don't share…, switch, off" — a double negative.
    aria-label={t('bankInstructions.title')}
    data-testid="bank-instructions-toggle"
/>`}
                >
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex flex-col gap-1">
                            <span className="text-body-s text-foreground-primary">Share bank instructions</span>
                            <span className="text-body-xs text-foreground-secondary">
                                The payer sees your bank details on the request page.
                            </span>
                        </div>
                        <Toggle
                            checked={shareBankInstructions}
                            onChange={setShareBankInstructions}
                            aria-label="Share bank instructions"
                        />
                    </div>
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
