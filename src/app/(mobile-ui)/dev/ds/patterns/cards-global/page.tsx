'use client'

import Card from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import Badge from '@/components/Global/Badges/Badge'
import NavigationArrow from '@/components/Global/NavigationArrow'
import { PropsTable } from '../../_components/PropsTable'
import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'
import { ProductUsage } from '../../_components/ProductUsage'

export default function CardsGlobalPage() {
    return (
        <DocPage>
            <DocHeader
                title="Card (Global)"
                description="Global shared Card component for stacked lists with position-aware border radius. Different from the Bruddle Card primitive (named export from 0_Bruddle)."
                status="production"
            />

            {/* Import */}
            <DocSection title="Import">
                <DesignNote type="warning">
                    This is the default export from Global/Card. The Bruddle Card is a named export: import {'{ Card }'}{' '}
                    from &apos;@/components/0_Bruddle/Card&apos;. They are different components.
                </DesignNote>
            </DocSection>

            {/* Single Card */}
            <DocSection title="Single Card">
                <DocSection.Content>
                    <Card position="solo">
                        <div className="flex items-center justify-between py-1">
                            <span className="text-label-l">Single Card</span>
                            <span className="text-body-xs text-foreground-secondary">position=&quot;solo&quot;</span>
                        </div>
                    </Card>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import Card from '@/components/Global/Card'`} />

                    <CodeBlock
                        label="Usage"
                        code={`<Card position="solo">
  <div>Content</div>
</Card>`}
                    />
                </DocSection.Code>
            </DocSection>

            {/* Stacked List */}
            <DocSection title="Stacked List">
                <DocSection.Content>
                    <p className="text-body-s text-foreground-secondary">
                        Cards stack seamlessly by using position props: first, middle, last. Only the first card has top
                        border-radius, only the last has bottom, and middle cards have no border-radius. Border-top is
                        removed on middle and last to avoid double borders.
                    </p>

                    <div>
                        {(['top', 'middle', 'middle', 'middle', 'bottom'] as const).map((pos, i) => (
                            <Card key={i} position={pos}>
                                <div className="flex items-center justify-between py-1">
                                    <span className="text-body-s">Item {i + 1}</span>
                                    <span className="text-body-xs text-foreground-secondary">
                                        position=&quot;{pos}&quot;
                                    </span>
                                </div>
                            </Card>
                        ))}
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Usage"
                        code={`{items.map((item, index) => {
  const position =
    items.length === 1 ? 'solo' :
    index === 0 ? 'top' :
    index === items.length - 1 ? 'bottom' :
    'middle'

  return (
    <Card key={item.id} position={position}>
      {/* Item content */}
    </Card>
  )
})}`}
                    />
                </DocSection.Code>
            </DocSection>

            {/* Clickable */}
            <DocSection title="Clickable Cards">
                <DocSection.Content>
                    <div>
                        <Card position="top" onClick={() => {}}>
                            <div className="flex items-center justify-between py-1">
                                <span className="text-body-s">Clickable item 1</span>
                                <span className="text-body-xs text-foreground-secondary">&rarr;</span>
                            </div>
                        </Card>
                        <Card position="bottom" onClick={() => {}}>
                            <div className="flex items-center justify-between py-1">
                                <span className="text-body-s">Clickable item 2</span>
                                <span className="text-body-xs text-foreground-secondary">&rarr;</span>
                            </div>
                        </Card>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Usage"
                        code={`<Card position="solo" onClick={() => router.push('/detail')}>
  <div>Clickable card content</div>
</Card>`}
                    />
                </DocSection.Code>
            </DocSection>

            {/* No Border */}
            <DocSection title="Without Border">
                <DocSection.Content>
                    <Card position="solo" border={false}>
                        <div className="py-1">
                            <span className="text-body-s">No border card</span>
                        </div>
                    </Card>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Usage" code={`<Card border={false}>Content</Card>`} />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            {/* Props */}
            <DocSection title="Props">
                <PropsTable
                    rows={[
                        {
                            name: 'position',
                            type: "'solo' | 'top' | 'middle' | 'bottom'",
                            default: "'solo'",
                            description: 'Controls border-radius for stacking',
                        },
                        { name: 'border', type: 'boolean', default: 'true', description: 'Show/hide border' },
                        { name: 'onClick', type: '() => void', default: '(none)', description: 'Makes card clickable' },
                        {
                            name: 'className',
                            type: 'string',
                            default: "''",
                            description: 'Override styles (base: w-full bg-background-default px-4 py-2)',
                        },
                        { name: 'children', type: 'ReactNode', default: '-', required: true },
                        { name: 'ref', type: 'Ref<HTMLDivElement>', default: '(none)' },
                    ]}
                />
            </DocSection>

            {/* Position behavior table */}
            <DocSection title="Position Behavior">
                <div className="overflow-x-auto rounded-sm border border-border-default text-body-xs">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border-default bg-background-badge-accent/20">
                                <th className="px-3 py-2 text-left text-label-m">Position</th>
                                <th className="px-3 py-2 text-left text-label-m">Border Radius</th>
                                <th className="px-3 py-2 text-left text-label-m">Border</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                ['solo', 'rounded-sm (all)', 'border border-border-default'],
                                ['top', 'rounded-t-sm (top only)', 'border border-border-default'],
                                ['middle', 'none', 'border border-border-default border-t-0'],
                                ['bottom', 'rounded-b-sm (bottom only)', 'border border-border-default border-t-0'],
                            ].map(([pos, radius, border]) => (
                                <tr key={pos} className="border-b border-border-default last:border-0">
                                    <td className="px-3 py-2 font-mono text-label-m">{pos}</td>
                                    <td className="px-3 py-2 font-mono">{radius}</td>
                                    <td className="px-3 py-2 font-mono">{border}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </DocSection>

            {/* Design Notes */}
            <DocSection title="Design Rules">
                <DesignNote type="info">
                    Use Global Card for stacked lists (transaction history, settings, token lists). Use Bruddle Card for
                    standalone content cards with shadows and variants.
                </DesignNote>
                <DesignNote type="info">
                    The base styles are: w-full bg-background-default px-4 py-2. Override with className for custom
                    padding or background.
                </DesignNote>
            </DocSection>

            <ProductUsage>
                <ProductUsage.Example
                    title="History — rows grouped by date"
                    path="src/app/(mobile-ui)/history/page.tsx"
                    description="position is computed per DATE GROUP, not per page: the list peeks at the next entry to see whether a new day starts, so every group rounds on its own."
                    code={`const isFirstInGroup = showHeader
const isLastInGroup = !nextItem || nextGroupKey !== currentGroupHeaderKey

let position: CardPosition = 'middle'
if (isFirstInGroup && isLastInGroup) position = 'solo'
else if (isFirstInGroup) position = 'top'
else if (isLastInGroup) position = 'bottom'`}
                >
                    <div>
                        <div className="mb-2 text-label-m text-foreground-primary">Today</div>
                        <Card position="top" className="p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-body-s">Sent to hugo</span>
                                <span className="text-body-s">-$12.00</span>
                            </div>
                        </Card>
                        <Card position="bottom" className="p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-body-s">Card payment</span>
                                <span className="text-body-s">-$4.50</span>
                            </div>
                        </Card>
                        <div className="mt-2 mb-2 text-label-m text-foreground-primary">Yesterday</div>
                        <Card position="solo" className="p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-body-s">Added money</span>
                                <span className="text-body-s">+$100.00</span>
                            </div>
                        </Card>
                    </div>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Profile — menu rows"
                    path="src/components/Profile/components/ProfileMenuItem.tsx"
                    description="Each row is a Card with p-4 (min-h-6 + p-4 = the 56px DS row). A row that navigates wraps the Card in a Link; a coming-soon row drops the link and takes the disabled background instead."
                    code={`<Link href={href} className="block">
  <Card position={position} onClick={onClick} className="p-4 active:bg-background-disabled">
    {content}
  </Card>
</Link>

{/* coming soon: no link, disabled fill */}
<Card position={position} className="bg-background-disabled p-4">
  {content}
</Card>`}
                >
                    <div>
                        <Card position="top" onClick={() => {}} className="cursor-pointer p-4">
                            <div className="flex min-h-6 items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Icon name="edit" size={20} fill="black" />
                                    <span className="text-body-m text-foreground-primary">Personal details</span>
                                </div>
                                <NavigationArrow size={24} className="fill-black" />
                            </div>
                        </Card>
                        <Card position="bottom" className="bg-background-disabled p-4">
                            <div className="flex min-h-6 items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Icon name="trophy" size={20} fill="black" />
                                    <span className="text-body-m text-foreground-primary">Referrals</span>
                                </div>
                                <Badge status="soon" size="medium" />
                            </div>
                        </Card>
                    </div>
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
