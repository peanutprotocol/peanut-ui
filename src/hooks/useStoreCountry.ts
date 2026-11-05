'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { type PluginListenerHandle } from '@capacitor/core'
import { isNativeBridge } from '@/utils/capacitor'
import { getStoreCountry, type StoreCountry } from '@/utils/store-country'

/**
 * Mount on the surface that makes a store-specific availability decision.
 * Keeps only a transient value, clears it on background/refresh, and reads
 * again on foreground. Call refresh immediately before a subsequent decision.
 * Unknown/loading must not grant a store-restricted feature.
 */
export function useStoreCountry() {
    const [country, setCountry] = useState<StoreCountry | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const mounted = useRef(false)
    const generation = useRef(0)

    const refresh = useCallback(async () => {
        if (!mounted.current) return null
        const request = ++generation.current
        setCountry(null)
        setIsLoading(true)
        const current = await getStoreCountry()
        if (!mounted.current || request !== generation.current) return null
        setCountry(current)
        setIsLoading(false)
        return current
    }, [])

    useEffect(() => {
        mounted.current = true
        let disposed = false
        const onActive = (active: boolean) => {
            if (disposed || !mounted.current) return
            if (active) void refresh()
            else {
                ++generation.current
                setCountry(null)
                setIsLoading(false)
            }
        }
        const onVisibility = () => onActive(document.visibilityState === 'visible')
        let listener: PluginListenerHandle | undefined

        if (isNativeBridge()) {
            // Native foreground events are authoritative; WebView visibility
            // events are not guaranteed when returning from store settings.
            void import('@capacitor/app')
                .then(({ App }) => App.addListener('appStateChange', ({ isActive }) => onActive(isActive)))
                .then((handle) => {
                    if (disposed) return handle.remove()
                    else listener = handle
                    return undefined
                })
                .catch(() => {
                    // Older shells may lack the lifecycle plugin. The next
                    // explicit refresh still reads the store without a cache.
                })
        }
        document.addEventListener('visibilitychange', onVisibility)
        if (document.visibilityState === 'visible') void refresh()
        else onActive(false)

        return () => {
            mounted.current = false
            disposed = true
            // This is a request sequence counter, not a DOM ref. Invalidate
            // whichever request is current at cleanup, including Strict Mode.
            // eslint-disable-next-line react-hooks/exhaustive-deps
            ++generation.current
            document.removeEventListener('visibilitychange', onVisibility)
            void listener?.remove().catch(() => {})
        }
    }, [refresh])

    return { country, isLoading, refresh }
}
