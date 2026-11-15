'use client'

import { createContext, useContext } from 'react'
import type { DeviceOs } from './environment'
import type { CreatorPageProps } from './types'

export type CreatorPageContextValue = {
    page: CreatorPageProps
    /** From the server's experiments.ts, so the cookie and the event name the experiment that picked this variant. */
    experimentId: string | null
    /** True on the dev preview route: no event, no cookie. */
    preview: boolean
    /** Decided on the server from the request's user agent. It picks the label and the store icon, nothing else. */
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
