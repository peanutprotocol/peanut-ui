import { Children } from 'react'

/**
 * One theme of rows inside a receipt or confirm card (Konrad's receipt-rows
 * pitch, 2026-10-02): the card's `divide-y` draws one dashed divider between
 * groups and none inside one. A group whose rows all resolved to nothing
 * renders nothing, so it leaves no empty slot and no stray divider.
 */
export const DataRowGroup = ({ children }: { children: React.ReactNode }) => {
    // ponytail: only literal null/false children are dropped; a child that
    // renders null itself still mounts, and `empty:hidden` hides that case
    const rows = Children.toArray(children)
    if (rows.length === 0) return null
    return <div className="ds-data-row-group empty:hidden">{rows}</div>
}
