'use client'

import StatusBadge, { type StatusType } from '@/components/Global/Badges/StatusBadge'
import StatusPill, { type StatusPillType } from '@/components/Global/StatusPill'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import NoDataEmptyState from '@/components/Global/EmptyStates/NoDataEmptyState'
import { Button } from '@/components/0_Bruddle/Button'
import { Notification } from '@/components/0_Bruddle/Notification'
import { PropsTable } from '../../_components/PropsTable'
import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'

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
                description="Status indicators (StatusBadge, StatusPill), inline errors (Notification priority=error), and empty states (EmptyState, NoDataEmptyState)."
                status="production"
            />

            {/* StatusBadge */}
            <DocSection title="StatusBadge">
                <DocSection.Content>
                    <p className="text-body-s text-foreground-secondary">
                        Rounded pill badge with text label. Three size variants. Shared StatusType across the codebase.
                    </p>

                    {/* All statuses */}
                    <div className="space-y-4">
                        <p className="text-label-m text-foreground-secondary uppercase">All Status Types</p>
                        <div className="flex flex-wrap gap-2">
                            {allStatuses.map((status) => (
                                <StatusBadge key={status} status={status} />
                            ))}
                        </div>
                    </div>

                    {/* Sizes */}
                    <div className="space-y-4">
                        <p className="text-label-m text-foreground-secondary uppercase">Sizes</p>
                        <div className="flex items-center gap-3">
                            {(['small', 'medium', 'large'] as const).map((size) => (
                                <div key={size} className="text-center">
                                    <StatusBadge status="completed" size={size} />
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
                                    'completed | pending | processing | failed | cancelled | refunded | soon | closed | custom',
                            },
                            { name: 'size', type: "'small' | 'medium' | 'large'", default: "'small'" },
                            {
                                name: 'customText',
                                type: 'string',
                                default: '(none)',
                                description: 'Text when status="custom"',
                            },
                            { name: 'className', type: 'string', default: "''", description: 'Override styles' },
                        ]}
                    />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Import"
                        code={`import StatusBadge from '@/components/Global/Badges/StatusBadge'`}
                    />

                    <CodeBlock
                        label="Usage"
                        code={`<StatusBadge status="completed" />
<StatusBadge status="pending" size="medium" />
<StatusBadge status="custom" customText="Active" />`}
                    />
                </DocSection.Code>
            </DocSection>

            {/* StatusPill */}
            <DocSection title="StatusPill">
                <DocSection.Content>
                    <p className="text-body-s text-foreground-secondary">
                        20px round icon chip (3px padding, 14px icon) on the badge background tokens — states board
                        17966:12128. Uses the same StatusType as StatusBadge (minus &quot;custom&quot;). Pairs well with
                        list items.
                    </p>

                    <div className="space-y-4">
                        <p className="text-label-m text-foreground-secondary uppercase">All Status Types</p>
                        <div className="flex flex-wrap items-center gap-4">
                            {allStatuses
                                .filter((s): s is StatusPillType => s !== 'custom')
                                .map((status) => (
                                    <div key={status} className="flex items-center gap-1.5">
                                        <StatusPill status={status} />
                                        <span className="text-body-xs">{status}</span>
                                    </div>
                                ))}
                        </div>
                    </div>

                    <PropsTable
                        rows={[
                            {
                                name: 'status',
                                type: 'StatusPillType',
                                default: '-',
                                required: true,
                                description: 'Same as StatusType but excludes "custom"',
                            },
                        ]}
                    />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import StatusPill from '@/components/Global/StatusPill'`} />

                    <CodeBlock label="Usage" code={`<StatusPill status="completed" />`} />
                </DocSection.Code>
            </DocSection>

            {/* Inline errors */}
            <DocSection title="Inline errors">
                <DocSection.Content>
                    <p className="text-body-s text-foreground-secondary">
                        Inline errors render the Notification primitive with priority=&quot;error&quot; (ErrorAlert was
                        deleted). See the Notification page under primitives for all variants.
                    </p>

                    <div className="space-y-2 rounded-sm border border-border-default p-3">
                        <Notification priority="error">Insufficient balance to complete this transaction.</Notification>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Import"
                        code={`import { Notification } from '@/components/0_Bruddle/Notification'`}
                    />

                    <CodeBlock
                        label="Usage"
                        code={`<Notification priority="error">Something went wrong. Please try again.</Notification>`}
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
                                <Button variant="purple" shadowSize="4" size="small" className="mt-2">
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
  cta={<Button variant="purple" size="small">Send Money</Button>}
/>`}
                    />
                </DocSection.Code>
            </DocSection>

            {/* NoDataEmptyState */}
            <DocSection title="NoDataEmptyState">
                <DocSection.Content>
                    <p className="text-body-s text-foreground-secondary">
                        Branded empty state with crying Peanutman GIF animation. For &quot;no data&quot; scenarios.
                    </p>

                    <div className="rounded-sm border border-border-default p-4">
                        <NoDataEmptyState message="Nothing to show here" />
                    </div>

                    <PropsTable
                        rows={[
                            {
                                name: 'message',
                                type: 'string',
                                default: '-',
                                required: true,
                                description: 'Text below the animation',
                            },
                            { name: 'cta', type: 'ReactNode', default: '(none)', description: 'Action below message' },
                            {
                                name: 'animSize',
                                type: "'sm' | 'md' | 'lg' | 'xl'",
                                default: "'sm'",
                                description: '96 / 128 / 192 / 256 px',
                            },
                        ]}
                    />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Import"
                        code={`import NoDataEmptyState from '@/components/Global/EmptyStates/NoDataEmptyState'`}
                    />

                    <CodeBlock label="Usage" code={`<NoDataEmptyState message="No links found" animSize="md" />`} />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            {/* Design Notes */}
            <DocSection title="Design Rules">
                <DesignNote type="info">
                    StatusBadge for text labels in tables/lists. StatusPill for compact icon-only indicators next to
                    items.
                </DesignNote>
                <DesignNote type="info">
                    Use EmptyState (card-based, icon) for structured empty states inside content areas. Use
                    NoDataEmptyState (Peanutman GIF) for full-section &quot;no data&quot; states.
                </DesignNote>
            </DocSection>
        </DocPage>
    )
}
