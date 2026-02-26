'use client'

import Card from '@/components/Global/Card'
import { PropsTable } from '../../_components/PropsTable'
import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'

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
                    <Card position="single">
                        <div className="flex items-center justify-between py-1">
                            <span className="text-sm font-bold">Single Card</span>
                            <span className="text-xs text-grey-1">position=&quot;single&quot;</span>
                        </div>
                    </Card>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import Card from '@/components/Global/Card'`} />

                    <CodeBlock
                        label="Usage"
                        code={`<Card position="single">
  <div>Content</div>
</Card>`}
                    />
                </DocSection.Code>
            </DocSection>

            {/* Stacked List */}
            <DocSection title="Stacked List">
                <DocSection.Content>
                    <p className="text-sm text-grey-1">
                        Cards stack seamlessly by using position props: first, middle, last. Only the first card has top
                        border-radius, only the last has bottom, and middle cards have no border-radius. Border-top is
                        removed on middle and last to avoid double borders.
                    </p>

                    <div>
                        {(['first', 'middle', 'middle', 'middle', 'last'] as const).map((pos, i) => (
                            <Card key={i} position={pos}>
                                <div className="flex items-center justify-between py-1">
                                    <span className="text-sm">Item {i + 1}</span>
                                    <span className="text-xs text-grey-1">position=&quot;{pos}&quot;</span>
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
    items.length === 1 ? 'single' :
    index === 0 ? 'first' :
    index === items.length - 1 ? 'last' :
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
                        <Card position="first" onClick={() => {}}>
                            <div className="flex items-center justify-between py-1">
                                <span className="text-sm">Clickable item 1</span>
                                <span className="text-xs text-grey-1">&rarr;</span>
                            </div>
                        </Card>
                        <Card position="last" onClick={() => {}}>
                            <div className="flex items-center justify-between py-1">
                                <span className="text-sm">Clickable item 2</span>
                                <span className="text-xs text-grey-1">&rarr;</span>
                            </div>
                        </Card>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Usage"
                        code={`<Card position="single" onClick={() => router.push('/detail')}>
  <div>Clickable card content</div>
</Card>`}
                    />
                </DocSection.Code>
            </DocSection>

            {/* No Border */}
            <DocSection title="Without Border">
                <DocSection.Content>
                    <Card position="single" border={false}>
                        <div className="py-1">
                            <span className="text-sm">No border card</span>
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
                            type: "'single' | 'first' | 'middle' | 'last'",
                            default: "'single'",
                            description: 'Controls border-radius for stacking',
                        },
                        { name: 'border', type: 'boolean', default: 'true', description: 'Show/hide border' },
                        { name: 'onClick', type: '() => void', default: '(none)', description: 'Makes card clickable' },
                        {
                            name: 'className',
                            type: 'string',
                            default: "''",
                            description: 'Override styles (base: w-full bg-white px-4 py-2)',
                        },
                        { name: 'children', type: 'ReactNode', default: '-', required: true },
                        { name: 'ref', type: 'Ref<HTMLDivElement>', default: '(none)' },
                    ]}
                />
            </DocSection>

            {/* Position behavior table */}
            <DocSection title="Position Behavior">
                <div className="overflow-x-auto rounded-sm border border-n-1 text-xs">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-n-1 bg-primary-3/20">
                                <th className="px-3 py-1.5 text-left font-bold">Position</th>
                                <th className="px-3 py-1.5 text-left font-bold">Border Radius</th>
                                <th className="px-3 py-1.5 text-left font-bold">Border</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                ['single', 'rounded-sm (all)', 'border border-black'],
                                ['first', 'rounded-t-sm (top only)', 'border border-black'],
                                ['middle', 'none', 'border border-black border-t-0'],
                                ['last', 'rounded-b-sm (bottom only)', 'border border-black border-t-0'],
                            ].map(([pos, radius, border]) => (
                                <tr key={pos} className="border-b border-n-1 last:border-0">
                                    <td className="px-3 py-1.5 font-mono font-bold">{pos}</td>
                                    <td className="px-3 py-1.5 font-mono">{radius}</td>
                                    <td className="px-3 py-1.5 font-mono">{border}</td>
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
                    The base styles are: w-full bg-white px-4 py-2. Override with className for custom padding or
                    background.
                </DesignNote>
            </DocSection>
        </DocPage>
    )
}
