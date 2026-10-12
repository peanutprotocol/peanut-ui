'use client'

import { Card } from '@/components/0_Bruddle/Card'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import ProgressBar from '@/components/0_Bruddle/ProgressBar'

/**
 * Sticky "how much of the copy review is left" bar.
 *
 * The board scrolls sideways and the email cards are spread across seven
 * columns, so without a running count there is no way to tell a half-finished
 * review from a finished one.
 */
export default function ReviewProgressStrip({
    checked,
    total,
    onReset,
}: {
    checked: number
    total: number
    onReset: () => void
}) {
    const done = total > 0 && checked === total
    const percent = total > 0 ? Math.round((checked / total) * 100) : 0

    return (
        <Card className="sticky top-0 z-30 flex-row flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
            <span className="text-label-l">
                Copy review: {checked}/{total || '…'} checked
            </span>
            <ProgressBar
                value={percent}
                className="min-w-24 flex-1"
                fillClassName={done ? 'bg-background-icon-bubble-green' : 'bg-action-secondary'}
            />
            <span className="text-label-m text-foreground-secondary">
                {done ? 'all reviewed' : `${total - checked} awaiting verdict`}
            </span>
            <LinkButton onClick={onReset}>Reset</LinkButton>
        </Card>
    )
}
