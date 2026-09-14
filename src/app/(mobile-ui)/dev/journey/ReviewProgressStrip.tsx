'use client'

import DevChip from '../_components/DevChip'

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
        <div className="sticky top-0 z-30 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-sm border border-border-default bg-white px-3 py-2">
            <span className="text-label-l">
                Copy review: {checked}/{total || '…'} checked
            </span>
            <div className="h-2 min-w-24 flex-1 overflow-hidden rounded-sm border border-border-default bg-white">
                <div
                    className={done ? 'h-full bg-green-400' : 'h-full bg-action-secondary'}
                    style={{ width: `${percent}%` }}
                    aria-hidden
                />
            </div>
            {done ? (
                <DevChip tone="green">all reviewed</DevChip>
            ) : (
                <DevChip tone="yellow">{total - checked} awaiting verdict</DevChip>
            )}
            <button
                type="button"
                onClick={onReset}
                className="text-[10px] text-foreground-secondary underline hover:text-foreground-primary"
            >
                reset
            </button>
        </div>
    )
}
