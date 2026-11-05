import type { UsEuTimelineRowProps } from './usEuAccounts.types'

/** A clock time on the left, the moment it shows on the right. */
export function UsEuTimelineRow({ time, children }: UsEuTimelineRowProps) {
    return (
        <div className="grid grid-cols-[3rem_1fr] items-start gap-2 xs:grid-cols-[3.75rem_1fr] xs:gap-3 md:grid-cols-[5rem_1fr]">
            <time className="pt-3 text-heading-card tabular-nums xs:text-heading-s">{time}</time>
            <div className="min-w-0">{children}</div>
        </div>
    )
}
