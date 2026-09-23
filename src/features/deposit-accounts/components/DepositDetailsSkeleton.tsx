'use client'

import Card from '@/components/Global/Card'

// interim placeholder tint: no skeleton surface token exists yet (design.md
// open conflict). never bg-border-default — that is a near-black border color.
const pulse = 'animate-pulse rounded bg-foreground-primary/10'

/**
 * The provisioning state renders the loaded layout, block for block, so
 * nothing jumps when the details arrive: the one details card, label above
 * value, then the collapsed terms row.
 *
 * The heading above stays real text, so the grey card reads as an account
 * being set up rather than a page that failed.
 */
export function DepositDetailsSkeleton({ rows }: { rows: number }) {
    return (
        <div className="flex flex-col gap-6" data-testid="deposit-details-skeleton">
            <Card position="solo" className="divide-y divide-dashed divide-border-default px-4 py-0">
                {Array.from({ length: rows }).map((_, index) => (
                    <div key={index} className="flex flex-col gap-1 py-3">
                        <div className={`h-3 w-24 ${pulse}`} />
                        <div className={`h-4 w-44 ${pulse}`} />
                    </div>
                ))}
            </Card>
            <div className={`h-13 w-full ${pulse}`} />
        </div>
    )
}
