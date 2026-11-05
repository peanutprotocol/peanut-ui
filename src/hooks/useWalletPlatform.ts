'use client'
import { useEffect, useState } from 'react'
import { type WalletPlatform, walletPlatformFromUserAgent } from '@/utils/wallet-platform'

/**
 * Detect the native wallet target for Apple Pay / Google Pay manual
 * provisioning copy. Runs only on the client — SSR returns `'other'` so the
 * UI doesn't flash a platform-specific layout before hydration.
 */
export function useWalletPlatform(): WalletPlatform {
    const [platform, setPlatform] = useState<WalletPlatform>('other')

    useEffect(() => {
        setPlatform(walletPlatformFromUserAgent(navigator.userAgent))
    }, [])

    return platform
}
