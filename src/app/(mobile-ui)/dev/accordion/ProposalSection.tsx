import { type ReactNode } from 'react'

/**
 * One real surface: what changes, then the dev markup and the Accordion
 * version one above the other, at phone width.
 */
export function ProposalSection({
    index,
    title,
    change,
    source,
    before,
    after,
}: {
    index: number
    title: string
    /** one line: what changed and which prop does it */
    change: ReactNode
    /** the file the before is copied from */
    source: string
    before: ReactNode
    after: ReactNode
}) {
    return (
        <section className="flex flex-col gap-4 border-t border-border-default pt-6">
            <div className="flex flex-col gap-1">
                <h2 className="text-heading-card text-foreground-primary">
                    {index}. {title}
                </h2>
                <p className="text-body-s text-foreground-primary">{change}</p>
                <p className="text-body-xs break-all text-foreground-secondary">{source}</p>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="flex max-w-sm flex-col gap-2">
                    <span className="text-body-s-semibold text-foreground-secondary">Before, on dev</span>
                    {before}
                </div>
                <div className="flex max-w-sm flex-col gap-2">
                    <span className="text-body-s-semibold text-foreground-secondary">After, on Accordion</span>
                    {after}
                </div>
            </div>
        </section>
    )
}
