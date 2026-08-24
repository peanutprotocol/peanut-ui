'use client'

import { twMerge } from '@/utils/tw'

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
    icon: string
    label: string
    count: number
    tint: string
    children: React.ReactNode
}) {
    return (
        <section className={twMerge('border-t border-n-1', tint)}>
            <header className="flex items-center gap-1.5 px-2.5 py-1.5">
                <span aria-hidden>{icon}</span>
                <span className="text-[10px] font-bold tracking-wide text-n-1 uppercase">{label}</span>
                <span className="text-[10px] font-bold text-grey-1">{count}</span>
            </header>
            <div className="flex flex-col gap-1.5 px-2 pb-2">{children}</div>
        </section>
    )
}
