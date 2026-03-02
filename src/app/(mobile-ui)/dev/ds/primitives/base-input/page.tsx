'use client'

import { useState } from 'react'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import { Playground } from '../../_components/Playground'
import { PropsTable } from '../../_components/PropsTable'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'

export default function BaseInputPage() {
    const [value, setValue] = useState('')

    return (
        <DocPage>
            <DocHeader
                title="BaseInput"
                description="Text input with sm/md/lg size variants and optional right content slot."
                status="production"
            />

            <Playground
                name="BaseInput"
                importPath={`import BaseInput from '@/components/0_Bruddle/BaseInput'`}
                defaults={{ variant: 'md', placeholder: 'Enter text...' }}
                controls={[
                    { type: 'select', prop: 'variant', label: 'variant', options: ['sm', 'md', 'lg'] },
                    { type: 'text', prop: 'placeholder', label: 'placeholder', placeholder: 'Placeholder text' },
                    { type: 'boolean', prop: 'disabled', label: 'disabled' },
                ]}
                render={(props) => (
                    <BaseInput
                        {...props}
                        className="w-full max-w-xs"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                    />
                )}
                codeTemplate={(props) => {
                    const parts = ['<BaseInput']
                    if (props.variant && props.variant !== 'md') parts.push(`variant="${props.variant}"`)
                    if (props.placeholder) parts.push(`placeholder="${props.placeholder}"`)
                    if (props.disabled) parts.push('disabled')
                    parts.push('/>')
                    return parts.join(' ')
                }}
            />

            <SectionDivider />

            <PropsTable
                rows={[
                    {
                        name: 'variant',
                        type: "'sm' | 'md' | 'lg'",
                        default: "'md'",
                        description: 'Height: sm=h-10, md=h-16, lg=h-20',
                    },
                    {
                        name: 'rightContent',
                        type: 'ReactNode',
                        default: '(none)',
                        description: 'Content in the right side of the input',
                    },
                    { name: 'className', type: 'string', default: '(none)' },
                ]}
            />

            <DocSection title="Sizes">
                <DocSection.Content>
                    <BaseInput variant="sm" placeholder="small (sm)" />
                    <BaseInput variant="md" placeholder="medium (md) — default" />
                    <BaseInput variant="lg" placeholder="large (lg)" />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import BaseInput from '@/components/0_Bruddle/BaseInput'`} />
                    <CodeBlock label="Basic Usage" code={`<BaseInput placeholder="Enter text..." />`} />
                    <CodeBlock
                        label="Size Variants"
                        code={`<BaseInput variant="sm" placeholder="Small" />
<BaseInput variant="md" placeholder="Medium" />
<BaseInput variant="lg" placeholder="Large" />`}
                    />
                </DocSection.Code>
            </DocSection>

            <DocSection title="With Right Content">
                <DocSection.Content>
                    <BaseInput placeholder="Amount" rightContent={<span className="text-sm text-grey-1">USD</span>} />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="With Right Content"
                        code={`<BaseInput
  placeholder="Amount"
  rightContent={<span className="text-sm text-grey-1">USD</span>}
/>`}
                    />
                </DocSection.Code>
            </DocSection>
        </DocPage>
    )
}
