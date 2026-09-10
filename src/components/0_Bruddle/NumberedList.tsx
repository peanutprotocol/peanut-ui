import React from 'react'
import { twMerge } from '@/utils/tw'

interface NumberedListProps {
    items: React.ReactNode[]
    className?: string
}

/**
 * Ordered steps with filled action-primary circle markers. Use it for a real
 * sequence — a set of unordered claims belongs in minimal bullets instead, and
 * a risk or caveat belongs in the screen's single Notification.
 */
export const NumberedList = ({ items, className }: NumberedListProps) => (
    <ol className={twMerge('flex w-full flex-col gap-3 text-left', className)}>
        {items.map((item, index) => (
            <li key={index} className="flex items-start gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-action-primary text-label-m text-black">
                    {index + 1}
                </span>
                <div className="min-w-0 flex-1 text-body-s text-foreground-primary">{item}</div>
            </li>
        ))}
    </ol>
)
