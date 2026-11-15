import type { ReactNode } from 'react'

/** One row of sample app UI inside a proof card. An illustration, not a control. */
export function A1SampleRow({
    leading,
    title,
    note,
    trailing,
}: {
    leading: ReactNode
    title: string
    note: string
    trailing?: ReactNode
}) {
    return (
        <div className="flex items-center gap-3 border-border-disabled bg-background-default px-3 py-2 not-first:border-t">
            {leading}
            <div className="min-w-0">
                <p className="text-body-s-semibold">{title}</p>
                <p className="text-body-xs text-foreground-secondary">{note}</p>
            </div>
            {trailing && <div className="ml-auto flex-none">{trailing}</div>}
        </div>
    )
}
