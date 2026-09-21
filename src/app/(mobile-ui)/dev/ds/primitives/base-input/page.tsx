'use client'

import { useState } from 'react'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import { Icon } from '@/components/Global/Icons/Icon'
import { Playground } from '../../_components/Playground'
import { PropsTable } from '../../_components/PropsTable'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'
import { ProductUsage } from '../../_components/ProductUsage'

export default function BaseInputPage() {
    const [value, setValue] = useState('')

    return (
        <DocPage>
            <DocHeader
                title="BaseInput"
                description="Text input with sm/md size variants and optional right content slot."
                status="production"
            />

            <Playground
                name="BaseInput"
                importPath={`import BaseInput from '@/components/0_Bruddle/BaseInput'`}
                defaults={{ variant: 'md', placeholder: 'Enter text...' }}
                controls={[
                    { type: 'select', prop: 'variant', label: 'variant', options: ['sm', 'md'] },
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
                        type: "'sm' | 'md'",
                        default: "'md'",
                        description: 'Height: sm=h-10 (40px), md=h-12 (48px, default)',
                    },
                    {
                        name: 'leftContent',
                        type: 'ReactNode',
                        default: '(none)',
                        description: "The input board's 40px leading slot (e.g. a currency prefix)",
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
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import BaseInput from '@/components/0_Bruddle/BaseInput'`} />
                    <CodeBlock label="Basic Usage" code={`<BaseInput placeholder="Enter text..." />`} />
                    <CodeBlock
                        label="Size Variants"
                        code={`<BaseInput variant="sm" placeholder="Small" />
<BaseInput variant="md" placeholder="Medium" />`}
                    />
                </DocSection.Code>
            </DocSection>

            <DocSection title="With Right Content">
                <DocSection.Content>
                    <BaseInput
                        placeholder="Amount"
                        leftContent={<span className="text-foreground-secondary">$</span>}
                    />
                    <BaseInput
                        placeholder="Amount"
                        rightContent={<span className="text-body-s text-foreground-secondary">USD</span>}
                    />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Leading slot"
                        code={`<BaseInput
  placeholder="Amount"
  leftContent={<span className="text-foreground-secondary">$</span>}
/>`}
                    />
                    <CodeBlock
                        label="With Right Content"
                        code={`<BaseInput
  placeholder="Amount"
  rightContent={<span className="text-body-s text-foreground-secondary">USD</span>}
/>`}
                    />
                </DocSection.Code>
            </DocSection>

            <DocSection title="Related Inputs (reference)">
                <DocSection.Content>
                    <p className="text-body-xs text-foreground-secondary">
                        Specialized inputs built on top of BaseInput. AmountInput has its own page under Patterns.
                    </p>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="ValidatedInput — async validation with debounce, used in setup flows"
                        code={`import ValidatedInput from '@/components/Global/ValidatedInput'`}
                    />
                    <CodeBlock
                        label="GeneralRecipientInput — multi-type recipient input (address, username, ...)"
                        code={`import GeneralRecipientInput from '@/components/Global/GeneralRecipientInput'`}
                    />
                </DocSection.Code>
            </DocSection>

            <ProductUsage>
                <ProductUsage.Example
                    title="Send — the note that rides with the payment"
                    path="src/features/payments/flows/direct-send/views/SendInputView.tsx"
                    description="Default md input, capped at 140 characters, under the amount field."
                    code={`<BaseInput
  placeholder={tCommon('comment')}
  value={attachment.message}
  maxLength={140}
  onChange={(e) =>
    setAttachment({ message: e.target.value, file: attachment.file, fileUrl: attachment.fileUrl })
  }
/>`}
                >
                    <BaseInput placeholder="Add a note" maxLength={140} defaultValue="dinner on saturday" />
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="SearchInput — the one search field"
                    path="src/components/SearchInput/index.tsx"
                    description="The shared search field is a thin wrapper over BaseInput: sm height, 40px side padding for the icon and the clear button."
                    code={`<BaseInput
  ref={inputRef}
  type="text"
  value={value}
  onChange={(e) => onChange(e.target.value)}
  placeholder={placeholder}
  className="h-10 w-full px-10 text-body-s font-normal"
/>`}
                >
                    <div className="relative">
                        <BaseInput
                            type="text"
                            placeholder="Search a country or currency"
                            defaultValue="argentina"
                            className="h-10 w-full px-10 text-body-s font-normal"
                        />
                        <Icon
                            name="search"
                            size={16}
                            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-foreground-secondary"
                        />
                    </div>
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
