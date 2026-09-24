'use client'

import Badge, { type IconStatusType, type StatusType } from '@/components/Global/Badges/Badge'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { PropsTable } from '../../_components/PropsTable'
import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { WhenToUse } from '../../_components/WhenToUse'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'
import { ProductUsage } from '../../_components/ProductUsage'

const allStatuses: StatusType[] = [
    'completed',
    'pending',
    'processing',
    'failed',
    'cancelled',
    'refunded',
    'soon',
    'closed',
]

export default function FeedbackPage() {
    return (
        <DocPage>
            <DocHeader
                title="Feedback"
                description="Status indicators, inline errors, and the documented EmptyState pattern."
                status="production"
            />

            <WhenToUse
                use={[
                    'Badge type=text for a status label in a list, a row, or a receipt. Badge type=icon for a compact status chip.',
                    'Callout priority="error" for a flow-level failure — an API or submission error you cannot attribute to one input.',
                    'Callout priority="attention" or "info" for a notice that belongs on the page itself.',
                    'EmptyState for a no-data content area, including the failed-fetch state of the same list.',
                ]}
                dontUse={[
                    'A validation error the user fixes in one input. → use FieldError under that input, never a Callout.',
                    'Transient background feedback. → use a toast (useToast).',
                    'A flow-blocking failure. → use an error step, or BackendErrorScreen for a full-page failure.',
                    'A maintenance or connectivity announcement. → use Global/Banner under the page NavHeader.',
                ]}
            />

            {/* Badge — text */}
            <DocSection title="Badge (type=text)">
                <DocSection.Content>
                    <p className="text-body-s text-foreground-secondary">
                        Rounded pill badge with a text label. Two sizes. Shared StatusType across the codebase.
                    </p>

                    {/* All statuses */}
                    <div className="space-y-4">
                        <p className="text-label-m text-foreground-secondary uppercase">All Status Types</p>
                        <div className="flex flex-wrap gap-2">
                            {allStatuses.map((status) => (
                                <Badge key={status} status={status} />
                            ))}
                        </div>
                    </div>

                    {/* Sizes */}
                    <div className="space-y-4">
                        <p className="text-label-m text-foreground-secondary uppercase">Sizes</p>
                        <div className="flex items-center gap-3">
                            {(['small', 'medium'] as const).map((size) => (
                                <div key={size} className="text-center">
                                    <Badge status="completed" size={size} />
                                    <p className="mt-1 text-body-xs text-foreground-secondary">{size}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <PropsTable
                        rows={[
                            {
                                name: 'status',
                                type: 'StatusType',
                                default: '-',
                                required: true,
                                description:
                                    'completed | pending | processing | failed | cancelled | refunded | soon | closed | neutral | custom',
                            },
                            { name: 'type', type: "'text' | 'icon'", default: "'text'" },
                            { name: 'size', type: "'small' | 'medium'", default: "'small'" },
                            {
                                name: 'customText',
                                type: 'string',
                                default: '(none)',
                                description: 'Text when status="custom" or "neutral" (neutral has no default word)',
                            },
                            { name: 'className', type: 'string', default: "''", description: 'Override styles' },
                        ]}
                    />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import Badge from '@/components/Global/Badges/Badge'`} />

                    <CodeBlock
                        label="Usage"
                        code={`<Badge status="completed" />
<Badge status="pending" size="medium" />
<Badge status="neutral" customText="1 of 2 used" />`}
                    />
                </DocSection.Code>
            </DocSection>

            {/* Badge — icon */}
            <DocSection title="Badge (type=icon)">
                <DocSection.Content>
                    <p className="text-body-s text-foreground-secondary">
                        20px round icon chip (3px padding, 14px icon) on the badge background tokens — states board
                        17966:12128. Same status map as the text badge, minus &quot;custom&quot;, which has no glyph.
                        Pairs well with list items.
                    </p>

                    <div className="space-y-4">
                        <p className="text-label-m text-foreground-secondary uppercase">All Status Types</p>
                        <div className="flex flex-wrap items-center gap-4">
                            {allStatuses
                                .filter((s): s is IconStatusType => s !== 'custom')
                                .map((status) => (
                                    <div key={status} className="flex items-center gap-1">
                                        <Badge type="icon" status={status} />
                                        <span className="text-body-xs">{status}</span>
                                    </div>
                                ))}
                        </div>
                    </div>

                    <PropsTable
                        rows={[
                            {
                                name: 'status',
                                type: 'IconStatusType',
                                default: '-',
                                required: true,
                                description: 'Same as StatusType but excludes "custom"',
                            },
                        ]}
                    />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import Badge from '@/components/Global/Badges/Badge'`} />

                    <CodeBlock label="Usage" code={`<Badge type="icon" status="completed" />`} />
                </DocSection.Code>
            </DocSection>

            {/* Inline errors */}
            <DocSection title="Inline errors">
                <DocSection.Content>
                    <p className="text-body-s text-foreground-secondary">
                        Inline errors render the Callout primitive with priority=&quot;error&quot; (ErrorAlert was
                        deleted). See the Callout page under primitives for all variants.
                    </p>

                    <div className="space-y-2 rounded-sm border border-border-default p-3">
                        <Callout priority="error">Insufficient balance to complete this transaction.</Callout>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import { Callout } from '@/components/0_Bruddle/Callout'`} />

                    <CodeBlock
                        label="Usage"
                        code={`<Callout priority="error">Something went wrong. Please try again.</Callout>`}
                    />
                </DocSection.Code>
            </DocSection>

            {/* EmptyState */}
            <DocSection title="EmptyState">
                <DocSection.Content>
                    <p className="text-body-s text-foreground-secondary">
                        Card-based empty state with icon, title, description, and optional CTA. Uses Global Card
                        internally.
                    </p>

                    <div className="space-y-4">
                        <EmptyState
                            icon="wallet"
                            title="No transactions yet"
                            description="Your transaction history will appear here."
                            cta={
                                <Button variant="primary" shadowSize="4" size="small" className="mt-2">
                                    Send Money
                                </Button>
                            }
                        />

                        <EmptyState icon="search" title="No results found" description="Try a different search term." />
                    </div>

                    <PropsTable
                        rows={[
                            {
                                name: 'icon',
                                type: 'IconName',
                                default: '-',
                                required: true,
                                description: 'Icon shown in pink circle',
                            },
                            { name: 'title', type: 'string | ReactNode', default: '-', required: true },
                            { name: 'description', type: 'string', default: '(none)' },
                            {
                                name: 'cta',
                                type: 'ReactNode',
                                default: '(none)',
                                description: 'Action button below text',
                            },
                            {
                                name: 'containerClassName',
                                type: 'string',
                                default: "''",
                                description: 'Override Card container',
                            },
                        ]}
                    />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Import"
                        code={`import EmptyState from '@/components/Global/EmptyStates/EmptyState'`}
                    />

                    <CodeBlock
                        label="Usage"
                        code={`<EmptyState
  icon="wallet"
  title="No transactions yet"
  description="Your history will appear here."
  cta={<Button variant="primary" size="small">Send Money</Button>}
/>`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            {/* Design Notes */}
            <DocSection title="Design Rules">
                <DesignNote type="info">
                    Badge type=text for labels in tables and lists. Badge type=icon for compact icon-only indicators
                    next to items.
                </DesignNote>
                <DesignNote type="info">
                    Use EmptyState for structured empty states inside content areas. Flag a different empty-state need
                    before adding an undocumented component.
                </DesignNote>
            </DocSection>

            <ProductUsage>
                <ProductUsage.Example
                    title="Receipt header — transaction status"
                    path="src/components/TransactionDetails/TransactionDetailsHeaderCard.tsx"
                    description="size=medium beside the amount. The status comes straight off the transaction, so every StatusType can land here."
                    code={`{showBadge && <Badge status={status!} size="medium" />}`}
                >
                    <div className="flex flex-col items-center gap-2">
                        <h1 className="text-heading-xl text-foreground-primary">-$24.00</h1>
                        <Badge status="completed" size="medium" />
                    </div>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Limits — a row that is not ready yet"
                    path="src/features/limits/views/LimitsPageView.tsx"
                    description="status=soon in a ListItem trailing slot. The row is disabled, and the badge is the reason."
                    code={`<ListItem
  position="solo"
  title={restOfWorldName}
  onClick={() => {}}
  disabled={true}
  trailing={<Badge status="soon" customText={tCommon('comingSoon')} />}
/>`}
                >
                    <ListItem
                        position="solo"
                        title="Rest of the world"
                        onClick={() => {}}
                        disabled
                        trailing={<Badge status="soon" customText="Coming soon" />}
                    />
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Home — no activity yet"
                    path="src/components/Home/HomeHistory.tsx"
                    description="The same component covers both empty and failed: icon txn-off for an empty list, icon alert with the error copy when the fetch fails."
                    code={`<EmptyState
  icon="txn-off"
  title={t('noActivityTitle')}
  description={t('emptyDescription')}
/>`}
                >
                    <EmptyState icon="txn-off" title="No activity yet" description="Your payments will show up here." />
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Send — payment failed"
                    path="src/features/payments/flows/direct-send/views/SendInputView.tsx"
                    description="Flow-level failures render as Callout priority=error under the CTA. Field-level problems use FieldError instead, never a Callout."
                    code={`{error.showError && <Callout priority="error">{error.errorMessage}</Callout>}`}
                >
                    <div className="space-y-4">
                        <Button variant="primary" shadowSize="4" className="w-full">
                            Send
                        </Button>
                        <Callout priority="error">Transaction failed. Please try again.</Callout>
                    </div>
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
