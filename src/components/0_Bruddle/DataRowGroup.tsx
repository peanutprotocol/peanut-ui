import { Children, type ReactNode } from 'react'
import { twMerge } from '@/utils/tw'

interface DataRowGroupProps {
    children: ReactNode
    className?: string
}

/**
 * A thematic block of `DataRow`s inside a receipt or review card. The card
 * keeps `divide-y divide-dashed divide-border-default px-4 py-0`; with groups
 * as its direct children the dashed line falls between groups only, never
 * between the rows of one group. Inside the block the rows share one padded
 * area: S/8 between rows (the list "tight gap"), and the block edge reads at
 * M/12 like a lone `DataRow` does (`py-2` here plus the row's own `py-1`).
 * Returns nothing when none of its rows rendered, so a group of conditional
 * rows never leaves an empty block or a stray divider behind.
 */
export const DataRowGroup = ({ children, className }: DataRowGroupProps) => {
    if (Children.toArray(children).length === 0) return null
    return <div className={twMerge('py-2 [&_.ds-data-row]:py-1', className)}>{children}</div>
}
