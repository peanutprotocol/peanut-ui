'use client'
import { useEffect, useRef, useState } from 'react'
import posthog from 'posthog-js'
import ScanToDownloadModal from '@/components/Migration/ScanToDownloadModal'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { isCapacitor } from '@/utils/capacitor'
import { openStore } from '@/utils/migration.utils'

/**
 * Guest-flow store handoff for the migration window (mockup §03/§08): when a
 * logged-out web visitor taps "Join Peanut" / "Continue with Peanut" on a
 * claim/request page, don't route them into a signup that's closed — desktop
 * opens the scan-to-download QR modal, phones deep-link their store.
 *
 * Returns `interceptGuestCta` (call it first in the CTA handler; true = the
 * click was handled here) and `storeHandoffModal` (render it next to the CTA).
 * Native app guests keep the normal in-app flow.
 */
export function useGuestStoreHandoff({
    trackImpressionWhenGuest = false,
}: { trackImpressionWhenGuest?: boolean } = {}) {
    const migrationOn = useMigrationFlag()
    const { deviceType } = useDeviceType()
    const [qrOpen, setQrOpen] = useState(false)

    // guest-funnel impression (TASK-20939): fires once per mount when the CTA
    // is actually shown to a logged-out web visitor during the window. The
    // caller passes its settled guest state so we don't count the pre-auth
    // flash where every visitor briefly looks logged-out.
    const impressionFired = useRef(false)
    useEffect(() => {
        if (!trackImpressionWhenGuest || !migrationOn || isCapacitor() || impressionFired.current) return
        impressionFired.current = true
        posthog.capture(ANALYTICS_EVENTS.MIGRATION_GUEST_CTA_SHOWN, { surface: MIGRATION_SURFACES.GUEST_FLOW })
    }, [trackImpressionWhenGuest, migrationOn])

    const interceptGuestCta = (): boolean => {
        if (!migrationOn || isCapacitor()) return false
        if (deviceType === DeviceType.WEB) {
            setQrOpen(true)
            return true
        }
        openStore(deviceType === DeviceType.ANDROID ? 'android' : 'ios', MIGRATION_SURFACES.GUEST_FLOW)
        return true
    }

    const storeHandoffModal = qrOpen ? (
        <ScanToDownloadModal visible onClose={() => setQrOpen(false)} surface={MIGRATION_SURFACES.GUEST_FLOW} />
    ) : null

    return { interceptGuestCta, storeHandoffModal }
}
