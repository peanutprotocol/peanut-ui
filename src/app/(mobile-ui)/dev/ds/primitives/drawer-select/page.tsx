'use client'

import { useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { DrawerSelect } from '@/components/0_Bruddle/DrawerSelect'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { SelectList } from '@/components/0_Bruddle/SelectList'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { Icon } from '@/components/Global/Icons/Icon'
import { LANGUAGE_OPTIONS } from '@/components/Global/languageOptions'
import { type AppLocale } from '@/i18n/app/config'
import { CodeBlock } from '../../_components/CodeBlock'
import { DocHeader } from '../../_components/DocHeader'
import { DocPage } from '../../_components/DocPage'
import { DocSection } from '../../_components/DocSection'
import { ProductUsage } from '../../_components/ProductUsage'
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
    const [funding, setFunding] = useState<Method | null>(null)
    const [language, setLanguage] = useState<AppLocale>('en')
    const fundingChosen = METHODS.find((m) => m.value === funding)
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

            <ProductUsage>
                <ProductUsage.Example
                    title="Sign-up payment plan — the Choose pickers"
                    path="src/components/Setup/Views/PaymentPlan.tsx"
                    description="A compact secondary Button inside the sentence is the trigger; each channel row leads with its concept bubble."
                    code={`<DrawerSelect<C>
  title={title}
  value={value}
  onChange={onChange}
  options={options.map((channel) => ({ value: channel, label: label(channel), leading: <ChannelIcon channel={channel} /> }))}
  trigger={<Button variant="secondary" size="compact" shadowSize="2" aria-haspopup="dialog">…</Button>}
/>`}
                >
                    <p className="text-heading-xs">
                        You&apos;ll first add money with{' '}
                        <DrawerSelect
                            title="Add money with"
                            options={METHODS}
                            value={funding}
                            onChange={setFunding}
                            trigger={
                                <Button
                                    variant="secondary"
                                    size="compact"
                                    shadowSize="2"
                                    aria-haspopup="dialog"
                                    className="inline-flex w-fit align-middle"
                                    icon={
                                        fundingChosen?.leading ?? <IconBubble icon={<span />} size="xs" color="gray" />
                                    }
                                    iconContainerClassName="size-6"
                                >
                                    {fundingChosen?.label ?? 'Choose'}
                                    <Icon name="chevron-down" size={20} className="shrink-0" />
                                </Button>
                            }
                        />
                    </p>
                </ProductUsage.Example>
                <ProductUsage.Example
                    title="Sign-up language picker"
                    path="src/components/Setup/components/SetupLanguageSwitcher.tsx"
                    description="A ghost Button in the header is the trigger. onChange is the async setLocale, so the drawer closes once the new language has loaded."
                    code={`<DrawerSelect
  title={t('title')}
  options={LANGUAGE_OPTIONS}
  value={locale}
  onChange={setLocale}
  trigger={<Button variant="ghost" aria-label={t('title')}>EN <Icon name="chevron-down" size={20} /></Button>}
/>`}
                >
                    <DrawerSelect
                        title="Language"
                        options={LANGUAGE_OPTIONS}
                        value={language}
                        onChange={setLanguage}
                        trigger={
                            <Button variant="ghost" aria-label="Language" className="w-fit shrink-0 gap-1">
                                {language.split('-')[0].toUpperCase()}
                                <Icon name="chevron-down" size={20} />
                            </Button>
                        }
                    />
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
