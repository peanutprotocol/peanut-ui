'use client'

import DevChip from '../_components/DevChip'

/**
 * "day N stuck" — the single badge shared by the email-machine rules strip and
 * every email card on the board, so the two read as the same fact.
 */
export default function StuckBadge({ days }: { days: number }) {
    return (
        <DevChip
            tone="yellow"
            title={`Sent once the user has been stuck in this stage for ${days} days — see the email-machine rules at the top of the page.`}
        >
            day {days} stuck
        </DevChip>
    )
}
