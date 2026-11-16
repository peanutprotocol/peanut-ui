'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import {
    getNativeStoreUpdatePolicy,
    getServerNativeStoreUpdatePolicy,
    subscribeKillSwitches,
} from '@/features/kill-switches/kill-switches-store'
import { getStoreUpdateOffer, type StoreUpdateOffer } from '@/utils/store-update'

let inFlight: { foreground: number; request: Promise<StoreUpdateOffer | null> } | null = null

async function checkStoreForForeground(foreground: number): Promise<StoreUpdateOffer | null> {
    // If a previous foreground's lookup is still settling, only the latest
    // foreground may start the next one. A concurrent subscriber shares it.
    if (inFlight?.foreground !== foreground) await inFlight?.request
    if (getNativeStoreUpdatePolicy().foreground !== foreground) return null
    if (inFlight?.foreground === foreground) return inFlight.request
    const request = getStoreUpdateOffer().finally(() => {
        inFlight = null
    })
    inFlight = { foreground, request }
    return request
}

export function useStoreUpdateOffer() {
    const { foreground, cutoffs } = useSyncExternalStore(
        subscribeKillSwitches,
        getNativeStoreUpdatePolicy,
        getServerNativeStoreUpdatePolicy
    )
    const [confirmed, setConfirmed] = useState<{ foreground: number; offer: StoreUpdateOffer | null } | null>(null)

    useEffect(() => {
        if (foreground === null) return
        let disposed = false

        void checkStoreForForeground(foreground).then((offer) => {
            if (!disposed) setConfirmed({ foreground, offer })
        })

        return () => {
            disposed = true
        }
    }, [foreground])

    return { offer: confirmed?.foreground === foreground ? confirmed.offer : null, cutoffs }
}
