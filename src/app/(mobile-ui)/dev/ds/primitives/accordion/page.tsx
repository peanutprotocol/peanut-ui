'use client'

import { useState } from 'react'
import { Accordion } from '@/components/0_Bruddle/Accordion'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Section } from '@/components/0_Bruddle/Section'
import { countryData } from '@/components/AddMoney/consts'
import { CountryList } from '@/components/Common/CountryList'
import Card from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import { MAX_QR_PAYMENT_AMOUNT_FOREIGN } from '@/constants/payment.consts'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { PropsTable } from '../../_components/PropsTable'
import { CodeBlock } from '../../_components/CodeBlock'
import { ProductUsage } from '../../_components/ProductUsage'
import { WhenToUse } from '../../_components/WhenToUse'

// a handful of real countries, so the examples show a list's shape without 200 rows
const EXAMPLE_COUNTRIES = countryData.filter(
    (country) => country.type === 'country' && !!country.iso2 && ['AR', 'BR', 'DE', 'ES'].includes(country.iso2)
)

const logCountry = (country: { title: string }) => console.log(`[ds/accordion] tap ${country.title}`)

export default function AccordionPage() {
    const [value, setValue] = useState<string>('expanded')
    // mirrors BridgeLimitsView's expandedCountry state
    const [expandedCountry, setExpandedCountry] = useState<string | undefined>('argentina')

    return (
        <DocPage>
            <DocHeader
                title="Accordion"
                description="From the figma accordion board (17802:61540), radix headless base. Every product collapsible: section headers, a row that opens a list, and the in-card link toggle."
                status="production"
            />

            <WhenToUse
                use={[
                    'Section titles the user scans, then opens only the one they need',
                    'Reference detail that is long when every section is open — per-country limits',
                    'One open section at a time: type="single" collapsible with value and onValueChange',
                    'Preselect the open section from the url, as the limits view does with ?region',
                ]}
                dontUse={[
                    'A ListItem with a hand-rolled chevron and aria-expanded — use a row trigger (title/body/leading)',
                    'Switching between panels of equal weight — use Tabs',
                    'A row that opens a detail view — use ListItem with a chevron',
                    'Long or scrollable detail content — use a Drawer',
                ]}
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
        <Accordion.Content>Pay up to $${MAX_QR_PAYMENT_AMOUNT_FOREIGN.toLocaleString()} per QR payment.</Accordion.Content>
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

            <DocSection title="A row in a group">
                <DocSection.Content>
                    {/* the withdraw shared-currency row: an item in a positional
                        group, its countries in flush content that continues the card */}
                    <Accordion type="single" collapsible className="gap-0">
                        <ListItem title="GBP · Faster Payments" body="British pound" chevron position="top" />
                        <Accordion.Item value="shared" position="bottom">
                            <Accordion.Trigger
                                leading={<IconBubble {...CONCEPT_ICONS.bank} size="s" />}
                                title="EUR · SEPA"
                                body="Euro"
                            />
                            <Accordion.Content flush forceMount>
                                <CountryList
                                    viewMode="add-withdraw"
                                    flow="withdraw"
                                    searchTerm=""
                                    countries={EXAMPLE_COUNTRIES}
                                    onCountryClick={logCountry}
                                    continuesGroup
                                />
                            </Accordion.Content>
                        </Accordion.Item>
                    </Accordion>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Row trigger, position, flush"
                        code={`<Accordion type="single" collapsible className="gap-0">
    <ListItem title="GBP · Faster Payments" chevron position="top" />
    <Accordion.Item value="EUR" position="bottom">
        <Accordion.Trigger leading={flag} title="EUR · SEPA" body="Euro" />
        {/* forceMount: closed stays mounted, so the list keeps its scroll */}
        <Accordion.Content flush forceMount>
            <CountryList countries={sepa} continuesGroup ... />
        </Accordion.Content>
    </Accordion.Item>
</Accordion>`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <DocSection title="Detached: the row and the list are two cards">
                <DocSection.Content>
                    <Accordion type="single" collapsible variant="detached">
                        <Accordion.Item value="countries">
                            <Accordion.Trigger
                                leading={<IconBubble {...CONCEPT_ICONS.otherCountries} size="s" />}
                                title="All countries"
                                body="Pick a country"
                            />
                            <Accordion.Content flush>
                                <CountryList
                                    viewMode="add-withdraw"
                                    flow="add"
                                    searchTerm=""
                                    countries={EXAMPLE_COUNTRIES}
                                    onCountryClick={logCountry}
                                />
                            </Accordion.Content>
                        </Accordion.Item>
                    </Accordion>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label='variant="detached"'
                        code={`{/* add money "All countries", withdraw "Other countries" (kush, 2026-09-25):
    the trigger is its own bordered row, the list its own card 8px below */}
<Accordion type="single" collapsible variant="detached">
    <Accordion.Item value="countries">
        <Accordion.Trigger leading={bubble} title="All countries" body="Pick a country" />
        <Accordion.Content flush>
            <CountryList ... />
        </Accordion.Content>
    </Accordion.Item>
</Accordion>`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <DocSection title="Link: the in-card toggle">
                <DocSection.Content>
                    <Card className="divide-y divide-dashed divide-border-default py-0">
                        <DataRow label="Deposit message" value="BRGXQ7K2M9" />
                        <Accordion type="single" collapsible variant="link">
                            <Accordion.Item value="bank-details">
                                <Accordion.Trigger>See bank details</Accordion.Trigger>
                                <Accordion.Content
                                    flush
                                    className="divide-y divide-dashed divide-border-default border-t border-dashed border-border-default"
                                >
                                    <DataRow label="Bank name" value="Banking Circle S.A." />
                                    <DataRow label="IBAN" value="LU90 4080 0000 4126 5803" />
                                    <DataRow label="BIC" value="BCIRLULL" />
                                </Accordion.Content>
                            </Accordion.Item>
                        </Accordion>
                    </Card>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label='variant="link"'
                        code={`{/* receipt bank details, the setup residence second country:
    no item border, an underlined 44px trigger row */}
<Accordion type="single" collapsible variant="link" value={open} onValueChange={setOpen}>
    <Accordion.Item value="bank-details">
        <Accordion.Trigger>{open ? 'Hide bank details' : 'See bank details'}</Accordion.Trigger>
        <Accordion.Content flush>...DataRows</Accordion.Content>
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
                        name: 'variant',
                        type: "'card' | 'link' | 'detached'",
                        default: "'card'",
                        description:
                            'On the root. card: bordered item. link: underlined in-card toggle. detached: the trigger is the bordered row, the content a separate card below',
                    },
                    {
                        name: 'Accordion.Item',
                        type: 'radix Item props',
                        default: '—',
                        description: 'value (required), disabled, position (solo|top|middle|bottom) to join a group',
                    },
                    {
                        name: 'Accordion.Trigger',
                        type: 'radix Trigger props',
                        default: '—',
                        description:
                            'Header row; chevron is built in. title/body/leading give the ListItem row anatomy and a div header, not an h3',
                    },
                    {
                        name: 'Accordion.Content',
                        type: 'radix Content props',
                        default: '—',
                        description:
                            'Divider + padded body, animated. flush: no padding, for content with its own rows. forceMount: closed stays mounted, hidden',
                    },
                ]}
            />

            <ProductUsage>
                <p className="text-body-s text-foreground-secondary">
                    Every product collapsible is an Accordion: the QR limits list below, the deposit account terms, the
                    add money &quot;All countries&quot; and withdraw &quot;Other countries&quot; rows (detached), the
                    withdraw shared-currency row (row in a group), the receipt bank details and the setup residence
                    second country (link).
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
                                            <span>
                                                Pay up to ${MAX_QR_PAYMENT_AMOUNT_FOREIGN.toLocaleString()} per QR
                                                payment.
                                            </span>
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
