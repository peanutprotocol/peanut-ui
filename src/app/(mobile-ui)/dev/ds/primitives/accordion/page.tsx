'use client'

import { useState } from 'react'
import { Accordion } from '@/components/0_Bruddle/Accordion'
import { Section } from '@/components/0_Bruddle/Section'
import { Icon } from '@/components/Global/Icons/Icon'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { PropsTable } from '../../_components/PropsTable'
import { CodeBlock } from '../../_components/CodeBlock'
import { ProductUsage } from '../../_components/ProductUsage'

export default function AccordionPage() {
    const [value, setValue] = useState<string>('expanded')
    // mirrors BridgeLimitsView's expandedCountry state
    const [expandedCountry, setExpandedCountry] = useState<string | undefined>('argentina')

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

            <ProductUsage>
                <p className="text-body-s text-foreground-secondary">
                    Accordion has ONE product call site today — the QR limits list below. Everything else that renders
                    it is a /dev surface (journey findings strip, passkey-help options). Treat the list of consumers as
                    short on purpose, not as a gap in this page.
                </p>
                <ProductUsage.Example
                    title="Limits — QR payment limits per country"
                    path="src/features/limits/views/BridgeLimitsView.tsx"
                    description="Bridge users without Manteca KYC scan country names and open only the one they pay in. The open item is preselected from the ?region query param."
                    code={`<Section title={t('qrPaymentLimits')}>
    <Accordion
        type="single"
        collapsible
        value={expandedCountry}
        onValueChange={(value) => setExpandedCountry(value as QrCountryId | undefined)}
    >
        {qrCountries.map((country) => (
            <Accordion.Item key={country.id} value={country.id}>
                <Accordion.Trigger>
                    <div className="flex items-center gap-2">
                        <Image src={country.flag} alt="" width={24} height={24} className="size-5 rounded-full object-cover" />
                        <span>{country.name}</span>
                    </div>
                </Accordion.Trigger>
                <Accordion.Content>
                    <div className="flex items-center gap-2">
                        <Icon name="check" className="text-green-500" size={16} />
                        <span>{t('qrPayLimit', { amount: \`$\${MAX_QR_PAYMENT_AMOUNT_FOREIGN.toLocaleString()}\` })}</span>
                    </div>
                </Accordion.Content>
            </Accordion.Item>
        ))}
    </Accordion>
</Section>`}
                >
                    <Section title="QR payment limits">
                        <Accordion
                            type="single"
                            collapsible
                            value={expandedCountry}
                            onValueChange={(value) => setExpandedCountry(value || undefined)}
                        >
                            {[
                                { id: 'argentina', name: 'Argentina' },
                                { id: 'brazil', name: 'Brazil' },
                            ].map((country) => (
                                <Accordion.Item key={country.id} value={country.id}>
                                    <Accordion.Trigger>
                                        <div className="flex items-center gap-2">
                                            {/* the real row puts a next/image flag here */}
                                            <span className="size-5 shrink-0 rounded-full bg-background-disabled" />
                                            <span>{country.name}</span>
                                        </div>
                                    </Accordion.Trigger>
                                    <Accordion.Content>
                                        <div className="flex items-center gap-2">
                                            <Icon name="check" className="text-green-500" size={16} />
                                            <span>Pay up to $500 per QR payment.</span>
                                        </div>
                                    </Accordion.Content>
                                </Accordion.Item>
                            ))}
                        </Accordion>
                    </Section>
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
