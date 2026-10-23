import { Icon } from '@/components/Global/Icons/Icon'
import { twMerge } from '@/utils/tw'
import type { RequestLinksPaidTickProps } from './requestLinks.types'

/** The green "Payment received" row the requester sees. */
export function RequestLinksPaidTick({ children, className }: RequestLinksPaidTickProps) {
    return (
        <div
            className={twMerge(
                'flex items-center gap-2 rounded-card border-2 border-border-default bg-background-badge-success px-3 py-2 text-label-l',
                className
            )}
        >
            <span className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-border-default bg-green-500 text-foreground-inverse">
                <Icon name="check" size={16} strokeWidth={3} />
            </span>
            {children}
        </div>
    )
}
