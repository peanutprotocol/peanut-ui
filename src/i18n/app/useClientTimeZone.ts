'use client'

import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}
const clientTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone
const serverTimeZone = () => 'UTC'

export function useClientTimeZone(): string {
    return useSyncExternalStore(subscribe, clientTimeZone, serverTimeZone)
}
