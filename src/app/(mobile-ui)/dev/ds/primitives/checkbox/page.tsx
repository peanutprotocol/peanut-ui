'use client'

import { useState } from 'react'
import Checkbox from '@/components/0_Bruddle/Checkbox'
import { PropsTable } from '../../_components/PropsTable'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'

export default function CheckboxPage() {
    const [checked, setChecked] = useState(false)

    return (
        <DocPage>
            <DocHeader title="Checkbox" description="Simple checkbox with optional label." status="production" />

            <SectionDivider />

            <PropsTable
                rows={[
                    { name: 'value', type: 'boolean', default: '(required)', required: true },
                    { name: 'onChange', type: '(e: ChangeEvent) => void', default: '(required)', required: true },
                    { name: 'label', type: 'string', default: '(none)' },
                ]}
            />

            <DocSection title="Examples">
                <DocSection.Content>
                    <Checkbox
                        label="I agree to the terms"
                        value={checked}
                        onChange={(e) => setChecked(e.target.checked)}
                    />

                    <div>
                        <Checkbox value={!checked} onChange={() => {}} />
                        <p className="text-xs text-grey-1">Without label</p>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import Checkbox from '@/components/0_Bruddle/Checkbox'`} />
                    <CodeBlock
                        label="With Label"
                        code={`<Checkbox
  label="I agree to the terms"
  value={checked}
  onChange={(e) => setChecked(e.target.checked)}
/>`}
                    />
                    <CodeBlock label="Without Label" code={`<Checkbox value={checked} onChange={() => {}} />`} />
                </DocSection.Code>
            </DocSection>
        </DocPage>
    )
}
