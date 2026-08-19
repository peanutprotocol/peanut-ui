'use client'

import { useEffect } from 'react'
import { zeroLegacyAndroidSafeAreaInsets } from '@/utils/capacitor'

// pre-Android-15 webviews can report phantom safe-area insets — zero them on mount (see util).
// no-op on web, iOS and Android 15+.
export function useZeroLegacyAndroidSafeAreaInsets() {
    useEffect(() => {
        void zeroLegacyAndroidSafeAreaInsets()
    }, [])
}
