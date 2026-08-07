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
        <div className="sticky top-0 z-30 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-sm border border-n-1 bg-white px-3 py-2">
            <span className="text-sm font-bold">
                Copy review: {checked}/{total || '…'} checked
            </span>
            <div className="h-2 min-w-24 flex-1 overflow-hidden rounded-sm border border-n-1 bg-white">
                <div
                    className={done ? 'h-full bg-green-1' : 'h-full bg-yellow-1'}
                    style={{ width: `${percent}%` }}
                    aria-hidden
                />
            </div>
            {done ? (
                <DevChip tone="green">all reviewed</DevChip>
            ) : (
                <DevChip tone="yellow">{total - checked} awaiting verdict</DevChip>
            )}
            <button type="button" onClick={onReset} className="text-[10px] text-grey-1 underline hover:text-n-1">
                reset
            </button>
        </div>
    )
}
