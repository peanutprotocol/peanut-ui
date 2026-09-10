import React from 'react'
import { twMerge } from '@/utils/tw'

type BulletListSize = 's' | 'xs'

interface BulletListProps {
    items: React.ReactNode[]
    size?: BulletListSize
    className?: string
}

const SIZE_STYLES: Record<BulletListSize, { text: string; marker: string }> = {
    s: { text: 'text-body-s', marker: 'h-5' },
    xs: { text: 'text-body-xs', marker: 'h-4' },
}

/**
 * Unordered text facts with the DS pink action marker. Use it for short,
 * non-interactive copy; navigable rows belong to ListItem instead.
 */
export const BulletList = ({ items, size = 's', className }: BulletListProps) => {
    const styles = SIZE_STYLES[size]

    return (
        <ul className={twMerge('flex w-full flex-col gap-2 text-left', className)}>
            {items.map((item, index) => (
                <li key={index} className="flex items-start gap-2">
                    <span aria-hidden className={twMerge('flex shrink-0 items-center', styles.marker)}>
                        <span className="rounded-round bg-action-primary size-1" />
                    </span>
                    <div className={twMerge('text-foreground-secondary min-w-0 flex-1', styles.text)}>{item}</div>
                </li>
            ))}
        </ul>
    )
}
