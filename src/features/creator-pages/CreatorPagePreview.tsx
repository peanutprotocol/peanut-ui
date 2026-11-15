'use client'

import type { ReactNode } from 'react'
import { CreatorPagePreviewContext } from './CreatorPageContext'

/** Wraps a page on the dev preview route: its button sends no event and its shell writes no cookie. */
export function CreatorPagePreview({ children }: { children: ReactNode }) {
    return <CreatorPagePreviewContext.Provider value={true}>{children}</CreatorPagePreviewContext.Provider>
}
