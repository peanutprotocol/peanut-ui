import { twMerge } from '@/utils/tw'
import type { HomeBalanceActivityRowProps } from './homeHinge.types'

/**
 * One activity entry on the drawn balance screen: badge, title over detail, signed amount.
 * The row wraps rather than squeezing the title: when the text column would drop under
 * 7rem (at 320px), the amount moves to its own line, right-aligned. `stacked` always puts
 * it there, so both rows of a screen with long amounts ("+USD 1.670,19") match.
 */
export function HomeBalanceActivityRow({ icon, title, detail, amount, tone, stacked }: HomeBalanceActivityRowProps) {
    return (
        <div
            className={twMerge(
                'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card border-2 border-border-default p-3',
                tone === 'in' ? 'bg-background-badge-success' : 'bg-background-default'
            )}
        >
            <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-border-default bg-background-icon-bubble-green text-label-l">
                {icon}
            </span>
            <span className="grid min-w-28 flex-1">
                <span className="text-label-l">{title}</span>
                <span className="text-body-xs whitespace-nowrap text-foreground-secondary">{detail}</span>
            </span>
            <span
                className={twMerge(
                    'ml-auto text-label-l whitespace-nowrap tabular-nums',
                    stacked && 'basis-full text-right'
                )}
            >
                {amount}
            </span>
        </div>
    )
}
