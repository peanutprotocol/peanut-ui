import { Card } from '@/components/0_Bruddle/Card'
import GlobalCard from '@/components/Global/Card'

const pulse = 'animate-pulse rounded bg-foreground-primary/10'

/**
 * Pending state: the exact loaded layout — memo card, then a details card
 * with the same row count — so the swap does not jump (design.md skeletons).
 * Interim placeholder tint per the open conflict; never bg-border-default.
 */
export function DetailsSkeleton({ rows, withMemo }: { rows: number; withMemo: boolean }) {
    return (
        <>
            {withMemo && (
                <Card className="flex flex-col gap-4 p-4">
                    <div className="flex flex-col gap-1">
                        <div className={`h-4 w-40 ${pulse}`} />
                        <div className={`h-10 w-full ${pulse}`} />
                    </div>
                    <div className={`h-12 w-full ${pulse}`} />
                </Card>
            )}
            <GlobalCard position="single" className="divide-y divide-dashed divide-border-default px-4 py-0">
                {Array.from({ length: rows }).map((_, index) => (
                    <div key={index} className="flex items-center justify-between gap-3 py-3">
                        <div className={`h-4 w-24 ${pulse}`} />
                        <div className={`h-4 w-36 ${pulse}`} />
                    </div>
                ))}
            </GlobalCard>
        </>
    )
}
