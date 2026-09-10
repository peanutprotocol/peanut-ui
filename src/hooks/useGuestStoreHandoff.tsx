'use client'
import { useEffect, useRef, useState } from 'react'
import posthog from 'posthog-js'
import ScanToDownloadModal from '@/components/Migration/ScanToDownloadModal'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { MIGRATION_SURFACES, type MigrationSurface } from '@/constants/migration.consts'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { isCapacitor } from '@/utils/capacitor'
import { openStore, type StoreHandoff } from '@/utils/migration.utils'

/**
 * During migration, send web guests to their store or a desktop QR modal.
 * Call interceptGuestCta before signup: true means the click was handled.
 * Render storeHandoffModal alongside the CTA. Native guests keep the in-app flow.
 */
export function useGuestStoreHandoff({
    trackImpressionWhenGuest = false,
    surface = MIGRATION_SURFACES.GUEST_FLOW,
}: { trackImpressionWhenGuest?: boolean; surface?: MigrationSurface } = {}) {
    const migrationOn = useMigrationFlag()
    const { deviceType } = useDeviceType()
    // null closes the modal; an open modal without a handoff encodes bare /app.
    const [pending, setPending] = useState<{ handoff?: StoreHandoff } | null>(null)

    // The caller waits for auth to settle so returning users do not count as guests.
    const impressionFired = useRef(false)
    useEffect(() => {
        if (!trackImpressionWhenGuest || !migrationOn || isCapacitor() || impressionFired.current) return
        impressionFired.current = true
        posthog.capture(ANALYTICS_EVENTS.MIGRATION_GUEST_CTA_SHOWN, { surface })
    }, [trackImpressionWhenGuest, migrationOn, surface])

    const interceptGuestCta = (handoff?: StoreHandoff): boolean => {
        if (!migrationOn || isCapacitor()) return false
        if (deviceType === DeviceType.WEB) {
            setPending({ handoff })
            return true
        }
        openStore(deviceType === DeviceType.ANDROID ? 'android' : 'ios', surface, handoff)
        return true
    }

    const storeHandoffModal = pending ? (
        <ScanToDownloadModal visible onClose={() => setPending(null)} surface={surface} handoff={pending.handoff} />
    ) : null

    return { interceptGuestCta, storeHandoffModal }
}
