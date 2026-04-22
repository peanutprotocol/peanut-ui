'use client'
import { useEffect, useState } from 'react'

export type WalletPlatform = 'ios' | 'android' | 'other'

/**
 * Detect the native wallet target for Apple Pay / Google Pay manual
 * provisioning copy. Runs only on the client — SSR returns `'other'` so the
 * UI doesn't flash a platform-specific layout before hydration.
 */
export function useWalletPlatform(): WalletPlatform {
    const [platform, setPlatform] = useState<WalletPlatform>('other')

    useEffect(() => {
        const ua = navigator.userAgent
        if (/iPhone|iPad|iPod/i.test(ua)) setPlatform('ios')
        else if (/Android/i.test(ua)) setPlatform('android')
        else setPlatform('other')
    }, [])

    return platform
}
