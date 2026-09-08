'use client'

import { useEffect, useState } from 'react'
import { hasKnownDeviceCredentials } from '@/components/Setup/setup-entry'
import { hasNativeSession } from '@/utils/auth-token'

/**
 * Whether this device already belongs to a Peanut user, with no live session
 * required: passkey credentials from an earlier registration (the web markers)
 * or a stored native session (the only branch that is reliable in the WebView,
 * where the passkey cookie is cross-origin-empty).
 *
 * `null` until the reads land — they touch document/localStorage and Capacitor
 * Preferences, so none of them can run during SSR or the hydration render.
 *
 * An explicit logout clears both signals, by design: that device goes back to
 * being anonymous until someone registers or logs in on it again.
 */
export function useKnownPeanutDevice(): boolean | null {
    const [knownDevice, setKnownDevice] = useState<boolean | null>(null)

    useEffect(() => {
        let cancelled = false

        const resolve = async () => {
            const known = hasKnownDeviceCredentials() || (await hasNativeSession())
            if (!cancelled) setKnownDevice(known)
        }
        void resolve()

        return () => {
            cancelled = true
        }
    }, [])

    return knownDevice
}
