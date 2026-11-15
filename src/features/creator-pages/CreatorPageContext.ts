'use client'

import { createContext, useContext } from 'react'
import type { DeviceOs } from './environment'
import type { CreatorPageProps } from './types'

export type CreatorPageContextValue = {
    page: CreatorPageProps
    /** True on the dev preview route: no event, no cookie. */
    preview: boolean
    /** `other` during server render and hydration, because the server never sees the user agent here. */
    deviceOs: DeviceOs
}

export const CreatorPageContext = createContext<CreatorPageContextValue | null>(null)

/** Only the dev preview route provides `true`. A variant cannot switch its own event off. */
export const CreatorPagePreviewContext = createContext(false)

export function useCreatorPage(): CreatorPageContextValue {
    const value = useContext(CreatorPageContext)
    if (!value) throw new Error('useCreatorPage must be used inside CreatorPageShell')
    return value
}
