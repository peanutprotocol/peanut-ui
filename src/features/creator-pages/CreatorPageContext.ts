'use client'

import { createContext, useContext } from 'react'
import type { StoreHandoff } from '@/utils/migration.utils'
import type { DeviceOs } from './environment'
import type { CreatorPageProps } from './types'

export type CreatorPageContextValue = {
    page: CreatorPageProps
    /** True on the preview route: no event, no cookie, no store hand-off. */
    preview: boolean
    /** Decided on the server from the request's user agent. It picks the label and the store icon, nothing else. */
    deviceOs: DeviceOs
    /** `interceptGuestCta` of useGuestStoreHandoff: true when it took the tap (store or desktop QR). */
    interceptGuestCta: (handoff?: StoreHandoff) => boolean
}

export const CreatorPageContext = createContext<CreatorPageContextValue | null>(null)

/** Only the preview route provides `true`. A variant cannot switch its own events off. */
export const CreatorPagePreviewContext = createContext(false)

export function useCreatorPage(): CreatorPageContextValue {
    const value = useContext(CreatorPageContext)
    if (!value) throw new Error('useCreatorPage must be used inside CreatorPageShell')
    return value
}
