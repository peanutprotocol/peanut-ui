'use client'

import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { DocPage } from '../../_components/DocPage'
import { TOKEN_GROUPS } from '../tokens.generated'

const SPACING_TOKENS = TOKEN_GROUPS['spacing'] ?? []

export default function SpacingPage() {
    return (
        <DocPage>
            <DocHeader title="Spacing" description="The spacing scale and layout conventions used across the app." />

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
                                <code className="w-24 shrink-0 font-mono text-label-m">
                                    --spacing{t.name && `-${t.name}`}
                                </code>
                                <span className="w-14 shrink-0 text-foreground-secondary">{t.value}</span>
                                <div className={`h-3 bg-action-primary ${t.previewClass}`} />
                            </div>
                        ))}
                    </div>
                )}
            </DocSection>

            {/* Common gap patterns */}
            <DocSection title="Common Gap Values">
                <div className="space-y-2 rounded-sm border border-border-default p-3 text-body-xs">
                    {[
                        ['gap-1', '4px', 'Tight grouping (icon + label)'],
                        ['gap-2', '8px', 'List and tight spacing'],
                        ['gap-3', '12px', 'Card list spacing'],
                        ['gap-4', '16px', 'Section spacing within a card'],
                        ['gap-6', '24px', 'Content block spacing'],
                        ['gap-8', '32px', 'Major section spacing'],
                    ].map(([cls, px, note]) => (
                        <div key={cls} className="flex items-center gap-3">
                            <code className="w-12 shrink-0 font-mono text-label-m">{cls}</code>
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
                        <code className="font-mono text-label-m text-foreground-primary">px-4</code> (16px)
                    </p>
                    <p>
                        Card internal padding:{' '}
                        <code className="font-mono text-label-m text-foreground-primary">p-4</code> (16px) or{' '}
                        <code className="font-mono text-label-m text-foreground-primary">p-6</code> (24px)
                    </p>
                    <p>
                        Section spacing:{' '}
                        <code className="font-mono text-label-m text-foreground-primary">space-y-6</code> or{' '}
                        <code className="font-mono text-label-m text-foreground-primary">gap-6</code>
                    </p>
                </div>
            </DocSection>
        </DocPage>
    )
}
