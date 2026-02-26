'use client'

import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'

export default function SpacingPage() {
    return (
        <DocPage>
            <DocHeader title="Spacing" description="Layout utilities and spacing conventions used across the app." />

            {/* Custom layout classes */}
            <DocSection title="Layout Utilities">
                <DocSection.Content>
                    <div className="space-y-2 rounded-sm border border-n-1 p-3 text-xs">
                        <div className="flex items-center gap-3">
                            <code className="w-12 font-mono font-bold">.row</code>
                            <span className="text-grey-1">flex items-center gap-2</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <code className="w-12 font-mono font-bold">.col</code>
                            <span className="text-grey-1">flex flex-col gap-2</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-xs font-bold">Example: .row</p>
                        <div className="row rounded-sm border border-n-1 p-3">
                            <div className="size-8 rounded-sm bg-purple-1" />
                            <div className="size-8 rounded-sm bg-primary-3" />
                            <div className="size-8 rounded-sm bg-yellow-1" />
                        </div>

                        <p className="text-xs font-bold">Example: .col</p>
                        <div className="col rounded-sm border border-n-1 p-3">
                            <div className="h-6 w-full rounded-sm bg-purple-1" />
                            <div className="h-6 w-full rounded-sm bg-primary-3" />
                            <div className="h-6 w-full rounded-sm bg-yellow-1" />
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
                <div className="space-y-2 rounded-sm border border-n-1 p-3 text-xs">
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
                            <span className="w-10 shrink-0 text-grey-1">{px}</span>
                            <span className="text-grey-1">{note}</span>
                        </div>
                    ))}
                </div>
            </DocSection>

            {/* Page padding */}
            <DocSection title="Page Padding">
                <div className="space-y-1 text-sm text-grey-1">
                    <p>
                        Standard page content padding: <code className="font-mono font-bold text-n-1">px-4</code> (16px)
                    </p>
                    <p>
                        Card internal padding: <code className="font-mono font-bold text-n-1">p-4</code> (16px) or{' '}
                        <code className="font-mono font-bold text-n-1">p-6</code> (24px)
                    </p>
                    <p>
                        Section spacing: <code className="font-mono font-bold text-n-1">space-y-6</code> or{' '}
                        <code className="font-mono font-bold text-n-1">gap-6</code>
                    </p>
                </div>
            </DocSection>
        </DocPage>
    )
}
