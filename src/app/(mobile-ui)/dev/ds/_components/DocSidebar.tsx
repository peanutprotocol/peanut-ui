'use client'

import { DocNavList } from './DocNavList'

/**
 * Desktop sidebar. The layout owns the sticky box around it, this owns the
 * landmark and the column width.
 */
export function DocSidebar() {
    return (
        <nav aria-label="Design system" className="w-56 border-r border-border-disabled pr-4 pb-6">
            <DocNavList />
        </nav>
    )
}
