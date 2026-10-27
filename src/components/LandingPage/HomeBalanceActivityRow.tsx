import { twMerge } from '@/utils/tw'
import type { HomeBalanceActivityRowProps } from './homeHinge.types'

/** One activity entry on the drawn balance screen: badge, title over detail, signed amount. */
export function HomeBalanceActivityRow({ icon, title, detail, amount, tone }: HomeBalanceActivityRowProps) {
    return (
        <div
            className={twMerge(
                'flex items-center gap-3 rounded-card border-2 border-border-default p-3',
                tone === 'in' ? 'bg-background-badge-success' : 'bg-background-default'
            )}
        >
            <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-border-default bg-yellow-500 text-label-l">
                {icon}
            </span>
            <span className="grid min-w-0 flex-1">
                <span className="text-label-l">{title}</span>
                <span className="text-body-xs text-foreground-secondary">{detail}</span>
            </span>
            <span className={twMerge('text-label-l whitespace-nowrap tabular-nums', tone === 'in' && 'text-green-800')}>
                {amount}
            </span>
        </div>
    )
}
