'use client'

import { useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { DrawerSelect } from '@/components/0_Bruddle/DrawerSelect'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { SelectList } from '@/components/0_Bruddle/SelectList'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { Icon } from '@/components/Global/Icons/Icon'
import { CodeBlock } from '../../_components/CodeBlock'
import { DocHeader } from '../../_components/DocHeader'
import { DocPage } from '../../_components/DocPage'
import { DocSection } from '../../_components/DocSection'
import { PropsTable } from '../../_components/PropsTable'
import { SectionDivider } from '../../_components/SectionDivider'
import { WhenToUse } from '../../_components/WhenToUse'

type Method = 'bank' | 'crypto' | 'qrPay'

const METHODS = [
    { value: 'bank' as const, label: 'Bank transfer', leading: <IconBubble {...CONCEPT_ICONS.bank} size="xs" /> },
    { value: 'crypto' as const, label: 'Crypto', leading: <IconBubble {...CONCEPT_ICONS.crypto} size="xs" /> },
    { value: 'qrPay' as const, label: 'QR payments', leading: <IconBubble {...CONCEPT_ICONS.qrPay} size="xs" /> },
]

export default function DrawerSelectPage() {
    const [method, setMethod] = useState<Method | null>(null)
    const [listValue, setListValue] = useState<Method | null>('crypto')
    const chosen = METHODS.find((m) => m.value === method)

    return (
        <DocPage>
            <DocHeader
                title="DrawerSelect"
                description="A select whose options open in a bottom drawer. The caller owns the trigger; the rows are a SelectList, so the chosen row is pale blue with a check."
                status="production"
            />

            <WhenToUse
                use={[
                    'A single choice whose options need an icon, a flag or a full label',
                    'A picker inside a sentence (compact Button trigger) or in a header (ghost Button trigger)',
                    'SelectList alone when the choice is the whole page, like the settings language list',
                ]}
                dontUse={[
                    'A short plain-text list inside a form — use BaseSelect',
                    'A long list the user must search — use Common/CountryCombobox',
                    'Several choices at once — this is single choice only',
                ]}
            />

            <SectionDivider />

            <PropsTable
                rows={[
                    { name: 'title', type: 'string', default: '(required)', required: true },
                    { name: 'trigger', type: 'ReactElement', default: '(required)', required: true },
                    {
                        name: 'options',
                        type: 'SelectOption<T>[] — { value, label, leading?, lang? }',
                        default: '(required)',
                        required: true,
                    },
                    { name: 'value', type: 'T | null', default: '(required)', required: true },
                    {
                        name: 'onChange',
                        type: '(value: T) => void | Promise<void>',
                        default: '(required)',
                        required: true,
                    },
                ]}
            />

            <DocSection title="Inside a sentence">
                <DocSection.Content>
                    <p className="text-heading-xs">
                        I&apos;ll pay with{' '}
                        <DrawerSelect
                            title="Pay with"
                            options={METHODS}
                            value={method}
                            onChange={setMethod}
                            trigger={
                                <Button
                                    variant="secondary"
                                    size="compact"
                                    shadowSize="2"
                                    aria-haspopup="dialog"
                                    className="inline-flex w-fit align-middle"
                                    icon={chosen?.leading ?? <IconBubble icon={<span />} size="xs" color="gray" />}
                                    iconContainerClassName="size-6"
                                >
                                    {chosen?.label ?? 'Choose'}
                                    <Icon name="chevron-down" size={20} className="shrink-0" />
                                </Button>
                            }
                        />
                    </p>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Import"
                        code={`import { DrawerSelect } from '@/components/0_Bruddle/DrawerSelect'`}
                    />
                    <CodeBlock
                        label="Usage"
                        code={`<DrawerSelect
  title="Pay with"
  options={[{ value: 'bank', label: 'Bank transfer', leading: <IconBubble {...CONCEPT_ICONS.bank} size="xs" /> }]}
  value={method}
  onChange={setMethod}
  trigger={<Button variant="secondary" size="compact" shadowSize="2">Choose</Button>}
/>`}
                    />
                </DocSection.Code>
            </DocSection>

            <DocSection title="SelectList on its own">
                <DocSection.Content>
                    <SelectList options={METHODS} value={listValue} onSelect={setListValue} />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import { SelectList } from '@/components/0_Bruddle/SelectList'`} />
                    <CodeBlock
                        label="Usage"
                        code={`<SelectList options={options} value={value} onSelect={setValue} />`}
                    />
                </DocSection.Code>
            </DocSection>

            <DocSection title="In the app">
                <DocSection.Content>
                    <ul className="space-y-1 list-none text-body-s text-foreground-secondary">
                        <li>Sign-up payment plan: the &quot;Choose&quot; pickers (Setup/Views/PaymentPlan.tsx)</li>
                        <li>Sign-up language picker in the header (Setup/components/SetupLanguageSwitcher.tsx)</li>
                        <li>Settings language page, SelectList only (Global/LanguageList.tsx)</li>
                    </ul>
                </DocSection.Content>
            </DocSection>
        </DocPage>
    )
}
