'use client'

import { Icon } from '@/components/Global/Icons/Icon'
import { twMerge } from '@/utils/tw'

export type StepTimelineState = 'done' | 'current' | 'next'
export type StepTimelineRow = { key: string; label: string; state: StepTimelineState }

/**
 * The ID check's numbered timeline: a green check when done, yellow when current, grey after. /verify's steps
 * screen and the sign-up Verify start draw the same rows.
 */
export function StepTimeline({
    rows,
    doneLabel,
    spinCurrent = false,
    className,
    testId,
    phase,
}: {
    rows: readonly StepTimelineRow[]
    /** read after a done row's label by a screen reader */
    doneLabel: string
    /** a spinner in the current circle instead of its number (the review wait) */
    spinCurrent?: boolean
    className?: string
    testId?: string
    phase?: string
}) {
    return (
        <ol className={twMerge('flex flex-col', className)} data-testid={testId} data-phase={phase}>
            {rows.map((row, index) => (
                <li
                    key={row.key}
                    aria-current={row.state === 'current' ? 'step' : undefined}
                    className="relative grid min-h-[4.625rem] grid-cols-[2rem_minmax(0,1fr)] gap-x-4 pb-6 last:min-h-8 last:pb-0"
                >
                    {index < rows.length - 1 && (
                        <span aria-hidden className="absolute top-8 bottom-0 left-[15.5px] w-px bg-border-subtle" />
                    )}
                    <span
                        aria-hidden
                        className={twMerge(
                            'relative z-10 flex size-8 items-center justify-center rounded-full text-body-m-semibold text-foreground-primary',
                            row.state === 'done'
                                ? 'bg-background-icon-bubble-green'
                                : row.state === 'current'
                                  ? 'bg-background-icon-bubble-yellow'
                                  : 'bg-background-icon-bubble-gray'
                        )}
                    >
                        {row.state === 'done' ? (
                            <Icon name="check" size={16} />
                        ) : row.state === 'current' && spinCurrent ? (
                            <span className="size-3.5 animate-spin rounded-full border-2 border-black border-r-transparent motion-reduce:animate-none" />
                        ) : (
                            index + 1
                        )}
                    </span>
                    {/* min-h, not h: a follow-up's label can take two lines on a narrow phone;
                        self-start keeps a one-line label on its circle instead of stretching to the row */}
                    <span className="flex min-h-8 items-center self-start text-left text-body-m-semibold text-foreground-primary">
                        {row.label}
                        {row.state === 'done' && <span className="sr-only"> {doneLabel}</span>}
                    </span>
                </li>
            ))}
        </ol>
    )
}
