'use client'

import { useState } from 'react'
import BaseSelect from '@/components/0_Bruddle/BaseSelect'
import { PropsTable } from '../../_components/PropsTable'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'

export default function BaseSelectPage() {
    const [value, setValue] = useState('')

    return (
        <DocPage>
            <DocHeader
                title="BaseSelect"
                description="Radix-based dropdown select with error and disabled states."
                status="production"
            />

            <SectionDivider />

            <PropsTable
                rows={[
                    { name: 'options', type: 'Array<{label, value}>', default: '(required)', required: true },
                    { name: 'placeholder', type: 'string', default: "'Select...'" },
                    { name: 'value', type: 'string', default: '(none)' },
                    { name: 'onValueChange', type: '(value: string) => void', default: '(none)' },
                    { name: 'disabled', type: 'boolean', default: 'false' },
                    { name: 'error', type: 'boolean', default: 'false' },
                ]}
            />

            <DocSection title="Default">
                <DocSection.Content>
                    <BaseSelect
                        options={[
                            { label: 'Option 1', value: '1' },
                            { label: 'Option 2', value: '2' },
                            { label: 'Option 3', value: '3' },
                        ]}
                        placeholder="Select an option"
                        value={value}
                        onValueChange={setValue}
                    />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import BaseSelect from '@/components/0_Bruddle/BaseSelect'`} />
                    <CodeBlock
                        label="Basic Usage"
                        code={`<BaseSelect
  options={[
    { label: 'Option 1', value: '1' },
    { label: 'Option 2', value: '2' },
    { label: 'Option 3', value: '3' },
  ]}
  value={value}
  onValueChange={setValue}
/>`}
                    />
                </DocSection.Code>
            </DocSection>

            <DocSection title="States">
                <DocSection.Content>
                    <div className="flex gap-2">
                        <BaseSelect options={[{ label: 'Disabled', value: 'd' }]} placeholder="disabled" disabled />
                        <BaseSelect options={[{ label: 'Error', value: 'e' }]} placeholder="error" error />
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="States"
                        code={`<BaseSelect options={[...]} disabled />
<BaseSelect options={[...]} error />`}
                    />
                </DocSection.Code>
            </DocSection>
        </DocPage>
    )
}
