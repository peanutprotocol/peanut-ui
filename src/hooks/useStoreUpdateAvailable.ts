'use client'

import { useEffect, useState } from 'react'
import { isCapacitor } from '@/utils/capacitor'
import { isStoreUpdateAvailable } from '@/utils/store-update'

/** Native compatibility debt alone does not mean an eligible store update exists. */
export function useStoreUpdateAvailable(required: boolean): boolean {
    const [available, setAvailable] = useState(false)

    useEffect(() => {
        if (!required || !isCapacitor()) return
        let disposed = false
        let generation = 0
        let removeListener: (() => Promise<void>) | undefined

        const check = async () => {
            const current = ++generation
            setAvailable(false)
            const result = await isStoreUpdateAvailable()
            if (!disposed && current === generation) setAvailable(result)
        }
        void check()
        import('@capacitor/app')
            .then(async ({ App }) => {
                const listener = await App.addListener('appStateChange', ({ isActive }) => {
                    if (isActive && !disposed) void check()
                })
                if (disposed) await listener.remove()
                else removeListener = () => listener.remove()
            })
            .catch(() => {})

        return () => {
            disposed = true
            void removeListener?.().catch(() => {})
        }
    }, [required])

    return required && available
}
