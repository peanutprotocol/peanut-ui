'use client'

import { twMerge } from '@/utils/tw'
import { Icon, type IconName } from '@/components/Global/Icons/Icon'

/**
 * One channel band inside a funnel column. Each band carries its own tint so
 * "what the user sees in the app" and "what we send them" are separable at a
 * glance instead of being one undifferentiated stack of cards.
 */
export default function BoardGroup({
    icon,
    label,
    count,
    tint,
    children,
}: {
    icon: IconName
    label: string
    count: number
    tint: string
    children: React.ReactNode
}) {
    return (
        <section className={twMerge('border-t border-border-default', tint)}>
            <header className="flex items-center gap-1 px-3 py-2">
                <Icon name={icon} size={16} />
                <span className="text-label-m text-foreground-primary">{label}</span>
                <span className="text-label-m text-foreground-secondary">{count}</span>
            </header>
            <div className="flex flex-col gap-2 px-2 pb-2">{children}</div>
        </section>
    )
}
