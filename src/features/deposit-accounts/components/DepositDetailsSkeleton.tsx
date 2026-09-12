import Card from '@/components/Global/Card'

// interim placeholder tint: no skeleton surface token exists yet (design.md
// open conflict). never bg-border-default — that is a near-black border color.
const pulse = 'animate-pulse rounded bg-foreground-primary/10'

/**
 * The provisioning state renders the loaded layout, block for block — the
 * title sentence, the holder notice, the section heading, a card with the
 * same row count — so nothing jumps when the details arrive.
 */
export function DepositDetailsSkeleton({ rows, withNotice }: { rows: number; withNotice: boolean }) {
    return (
        <>
            {withNotice && <div className={`h-16 w-full ${pulse}`} />}
            <div className="flex flex-col gap-2">
                <div className={`h-5 w-28 ${pulse}`} />
                <Card position="single" className="divide-y divide-dashed divide-border-default px-4 py-0">
                    {Array.from({ length: rows }).map((_, index) => (
                        <div key={index} className="flex items-center justify-between gap-3 py-3">
                            <div className={`h-4 w-24 ${pulse}`} />
                            <div className={`h-4 w-36 ${pulse}`} />
                        </div>
                    ))}
                </Card>
            </div>
            <div className={`h-4 w-52 ${pulse}`} />
        </>
    )
}
