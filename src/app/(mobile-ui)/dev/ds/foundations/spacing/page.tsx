'use client'

import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'
import { TOKEN_GROUPS } from '../tokens.generated'

const SPACING_TOKENS = TOKEN_GROUPS['spacing'] ?? []

export default function SpacingPage() {
    return (
        <DocPage>
            <DocHeader title="Spacing" description="Layout utilities and spacing conventions used across the app." />

            {/* Spacing tokens — generated; empty until DS 06 lands the named scale */}
            <DocSection title="Spacing Tokens">
                {SPACING_TOKENS.length === 0 ? (
                    <DesignNote type="info">
                        No custom spacing tokens in @theme yet — the app uses the stock Tailwind 4px scale. The named
                        scale (xs/s/m/l/…) is deferred to the DS 06 consumer sweep; this section auto-populates from
                        globals.css when it lands (pnpm gen:ds-tokens).
                    </DesignNote>
                ) : (
                    <div className="space-y-2 rounded-sm border border-border-default p-3 text-body-xs">
                        {SPACING_TOKENS.map((t) => (
                            <div key={t.name} className="flex items-center gap-3">
                                <code className="w-24 shrink-0 font-mono font-bold">
                                    --spacing{t.name && `-${t.name}`}
                                </code>
                                <span className="w-14 shrink-0 text-foreground-secondary">{t.value}</span>
                                <div className="h-3 bg-action-primary" style={{ width: t.value }} />
                            </div>
                        ))}
                    </div>
                )}
            </DocSection>

            {/* Custom layout classes */}
            <DocSection title="Layout Utilities">
                <DocSection.Content>
                    <div className="space-y-2 rounded-sm border border-border-default p-3 text-body-xs">
                        <div className="flex items-center gap-3">
                            <code className="w-12 font-mono font-bold">.row</code>
                            <span className="text-foreground-secondary">flex items-center gap-2</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <code className="w-12 font-mono font-bold">.col</code>
                            <span className="text-foreground-secondary">flex flex-col gap-2</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-label-m">Example: .row</p>
                        <div className="row rounded-sm border border-border-default p-3">
                            <div className="size-8 rounded-sm bg-action-primary" />
                            <div className="size-8 rounded-sm bg-background-badge-accent" />
                            <div className="size-8 rounded-sm bg-action-secondary" />
                        </div>

                        <p className="text-label-m">Example: .col</p>
                        <div className="col rounded-sm border border-border-default p-3">
                            <div className="h-6 w-full rounded-sm bg-action-primary" />
                            <div className="h-6 w-full rounded-sm bg-background-badge-accent" />
                            <div className="h-6 w-full rounded-sm bg-action-secondary" />
                        </div>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Row Layout" code={`<div className="row">...</div>`} />
                    <CodeBlock label="Col Layout" code={`<div className="col">...</div>`} />
                </DocSection.Code>
            </DocSection>

            {/* Common gap patterns */}
            <DocSection title="Common Gap Values">
                <div className="space-y-2 rounded-sm border border-border-default p-3 text-body-xs">
                    {[
                        ['gap-1', '4px', 'Tight grouping (icon + label)'],
                        ['gap-2', '8px', 'Default row/col spacing'],
                        ['gap-3', '12px', 'Card list spacing'],
                        ['gap-4', '16px', 'Section spacing within a card'],
                        ['gap-6', '24px', 'Content block spacing'],
                        ['gap-8', '32px', 'Major section spacing'],
                    ].map(([cls, px, note]) => (
                        <div key={cls} className="flex items-center gap-3">
                            <code className="w-12 shrink-0 font-mono font-bold">{cls}</code>
                            <span className="w-10 shrink-0 text-foreground-secondary">{px}</span>
                            <span className="text-foreground-secondary">{note}</span>
                        </div>
                    ))}
                </div>
            </DocSection>

            {/* Page padding */}
            <DocSection title="Page Padding">
                <div className="space-y-1 text-body-s text-foreground-secondary">
                    <p>
                        Standard page content padding:{' '}
                        <code className="font-mono font-bold text-foreground-primary">px-4</code> (16px)
                    </p>
                    <p>
                        Card internal padding: <code className="font-mono font-bold text-foreground-primary">p-4</code>{' '}
                        (16px) or <code className="font-mono font-bold text-foreground-primary">p-6</code> (24px)
                    </p>
                    <p>
                        Section spacing: <code className="font-mono font-bold text-foreground-primary">space-y-6</code>{' '}
                        or <code className="font-mono font-bold text-foreground-primary">gap-6</code>
                    </p>
                </div>
            </DocSection>
        </DocPage>
    )
}
