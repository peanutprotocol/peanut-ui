'use client'
import { useState } from 'react'
import ScanToDownloadModal from '@/components/Migration/ScanToDownloadModal'
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
export function useGuestStoreHandoff() {
    const migrationOn = useMigrationFlag()
    const { deviceType } = useDeviceType()
    const [qrOpen, setQrOpen] = useState(false)

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
