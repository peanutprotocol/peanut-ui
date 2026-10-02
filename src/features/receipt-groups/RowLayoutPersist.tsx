'use client'

import { useRowLayout } from './useRowLayout'

/**
 * Mounted once in the mobile layout so the `?rows=` value is promoted to the
 * session on whichever page the flow enters (the withdraw hub, say), before
 * any review or receipt card is on screen. Renders nothing.
 */
export function RowLayoutPersist() {
    useRowLayout()
    return null
}
