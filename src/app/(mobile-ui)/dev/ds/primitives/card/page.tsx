'use client'

import { Card } from '@/components/0_Bruddle/Card'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Playground } from '../../_components/Playground'
import { PropsTable } from '../../_components/PropsTable'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'
import { ProductUsage } from '../../_components/ProductUsage'
import { WhenToUse } from '../../_components/WhenToUse'

export default function CardPage() {
    return (
        <DocPage>
            <DocHeader
                title="Card"
                description="Standalone container with optional shadow. Compound component with Header, Title, Description, Content sub-components."
                status="production"
            />

            <WhenToUse
                use={[
                    'A standalone block on a screen — icon bubble, title, body, CTA',
                    'A summary surface that holds one result or one number',
                    'Set the padding yourself — a bare Card has none (p-4 inside blocks, p-6 for the board CTA card)',
                    'Add shadowSize to lift the card; leave it off for a flat block',
                ]}
                dontUse={[
                    'Stacked list rows — use ListItem inside a ListGroup',
                    'Rows inside the card — use DataRow; a ListItem there doubles the borders',
                    'A no-data state — use EmptyState',
                    'An inline status or error message — use Callout',
                ]}
            />

            <Playground
                name="Card"
                importPath={`import { Card } from '@/components/0_Bruddle/Card'`}
                defaults={{ shadowSize: '4' }}
                controls={[{ type: 'select', prop: 'shadowSize', label: 'shadowSize', options: ['4', '6', '8'] }]}
                render={(props) => (
                    <Card {...props} className="w-full max-w-xs p-4">
                        <Card.Header>
                            <Card.Title>Card Title</Card.Title>
                            <Card.Description>A description of the card content</Card.Description>
                        </Card.Header>
                        <Card.Content>
                            <p className="text-body-s">Body content goes here</p>
                        </Card.Content>
                    </Card>
                )}
                codeTemplate={(props) => {
                    const parts = ['<Card']
                    if (props.shadowSize) parts.push(`shadowSize="${props.shadowSize}"`)
                    parts.push('className="p-4">')
                    return (
                        parts.join(' ') +
                        '\n  <Card.Header>\n    <Card.Title>Title</Card.Title>\n    <Card.Description>Description</Card.Description>\n  </Card.Header>\n  <Card.Content>Content</Card.Content>\n</Card>'
                    )
                }}
            />

            <SectionDivider />

            <PropsTable
                rows={[
                    { name: 'shadowSize', type: "'4' | '6' | '8'", default: '(none)' },
                    { name: 'className', type: 'string', default: '(none)' },
                ]}
            />

            <DocSection title="Shadow Variants">
                <DocSection.Content>
                    <div className="space-y-3">
                        <Card className="p-4">
                            <p className="text-body-s">No shadow</p>
                        </Card>
                        <Card shadowSize="4" className="p-4">
                            <p className="text-body-s">shadowSize=&quot;4&quot;</p>
                        </Card>
                        <Card shadowSize="6" className="p-4">
                            <p className="text-body-s">shadowSize=&quot;6&quot;</p>
                        </Card>
                        <Card shadowSize="8" className="p-4">
                            <p className="text-body-s">shadowSize=&quot;8&quot;</p>
                        </Card>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import { Card } from '@/components/0_Bruddle/Card'`} />
                </DocSection.Code>
            </DocSection>

            <DocSection title="With Sub-components">
                <DocSection.Content>
                    <Card shadowSize="4" className="p-4">
                        <Card.Header>
                            <Card.Title>Card Title</Card.Title>
                            <Card.Description>description text</Card.Description>
                        </Card.Header>
                        <Card.Content>
                            <p className="text-body-s">body content</p>
                        </Card.Content>
                    </Card>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Sub-components Example"
                        code={`<Card shadowSize="4" className="p-4">
  <Card.Header>
    <Card.Title>Title</Card.Title>
    <Card.Description>Description</Card.Description>
  </Card.Header>
  <Card.Content>Content</Card.Content>
</Card>`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <DocSection
                title="Board Variants"
                description="Figma card board (17802:61536): icon bubble + heading + body + CTA compositions."
            >
                <DocSection.Content>
                    <div className="space-y-4">
                        <Card className="items-center gap-6 p-6 text-center">
                            <div className="flex flex-col items-center gap-2">
                                <IconBubble icon="check" color="green" />
                                <div className="flex flex-col items-center gap-1">
                                    <Card.Title className="pb-0 text-center">Verify to get started</Card.Title>
                                    <Card.Description className="text-center">
                                        Use bank accounts and other local payment methods
                                    </Card.Description>
                                </div>
                            </div>
                            <Button variant="primary" className="w-full">
                                Verify now
                            </Button>
                        </Card>
                        <Card className="items-center gap-6 p-6 text-center">
                            <div className="flex flex-col items-center gap-2">
                                <IconBubble icon="check" color="yellow" />
                                <div className="flex flex-col items-center gap-1">
                                    <Card.Title className="pb-0 text-center">Verify to get started</Card.Title>
                                    <Card.Description className="text-center">
                                        Use bank accounts and other local payment methods
                                    </Card.Description>
                                </div>
                            </div>
                            <div className="flex w-full flex-col gap-3">
                                <Button variant="primary" className="w-full">
                                    Path 1
                                </Button>
                                <Button variant="secondary" className="w-full">
                                    Path 2
                                </Button>
                            </div>
                        </Card>
                        <Card className="items-center gap-6 p-6 text-center">
                            <div className="flex flex-col items-center gap-2">
                                <IconBubble icon="wallet" color="gray" />
                                <div className="flex flex-col items-center gap-1">
                                    <Card.Title className="pb-0 text-center">No custodial wallet</Card.Title>
                                    <Card.Description className="text-center">
                                        Only you control this wallet, we can&apos;t recover it if you lose access.
                                    </Card.Description>
                                </div>
                            </div>
                        </Card>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="card.cta.primary"
                        code={`<Card className="items-center gap-6 p-6 text-center">
  <div className="flex flex-col items-center gap-2">
    <IconBubble icon="check" color="green" />
    <div className="flex flex-col items-center gap-1">
      <Card.Title className="pb-0">Verify to get started</Card.Title>
      <Card.Description>Use bank accounts…</Card.Description>
    </div>
  </div>
  <Button variant="primary" className="w-full">Verify now</Button>
</Card>`}
                    />
                </DocSection.Code>
            </DocSection>

            <ProductUsage>
                <ProductUsage.Example
                    title="Payment success — summary row"
                    path="src/features/payments/shared/components/PaymentSuccessView.tsx"
                    description="No shadow, row layout: green check bubble beside the amount and recipient."
                    code={`<Card className="flex items-center gap-3 p-4">
  <div className="flex items-center gap-3">
    <IconBubble icon="check" color="green" />
  </div>
  <div className="space-y-1">
    <h1 className="text-body-s text-foreground-secondary">{getTitle()}</h1>
    ...
  </div>
</Card>`}
                >
                    <Card className="flex items-center gap-3 p-4">
                        <div className="flex items-center gap-3">
                            <IconBubble icon="check" color="green" />
                        </div>
                        <div className="space-y-1">
                            <h1 className="text-body-s text-foreground-secondary">You sent to lucia</h1>
                            <p className="text-heading-s">$24.00</p>
                        </div>
                    </Card>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Rewards — invite earnings"
                    path="src/app/(mobile-ui)/rewards/invites/page.tsx"
                    description="Centered column card holding one number — the lifetime USD earned from invites."
                    code={`<Card className="flex flex-col items-center justify-center gap-2 p-4">
  <h2 className="text-center text-body-m text-foreground-primary">
    {t('friendsEarnedYou')}
  </h2>
  <span className="text-heading-m text-foreground-primary">
    \${invites.summary.totalLifetimeEarnedUsd.toFixed(2)}
  </span>
</Card>`}
                >
                    <Card className="flex flex-col items-center justify-center gap-2 p-4">
                        <h2 className="text-center text-body-m text-foreground-primary">Your friends earned you</h2>
                        <span className="text-heading-m text-foreground-primary">$18.50</span>
                        <span className="text-body-s text-foreground-secondary">1,850 points</span>
                    </Card>
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
