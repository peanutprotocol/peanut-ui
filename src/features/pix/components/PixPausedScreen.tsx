'use client'

import { MantecaTransfersMaintenanceView } from '@/components/Global/Banner/MantecaTransfersMaintenanceView'
import { BrazilPausedScreen } from '@/features/brazil-pause/components/BrazilPausedScreen'
import type { CapabilityRoute } from '@/types/capabilities'

/**
 * A paused Pix route. The router reads the pause switches, so this screen is the
 * only pause the Pix pages show. `residence_paused`: the app-wide pause of the
 * user's residence, in its own words. Any other reason (`provider_paused`, a
 * provider or a currency switched off): the provider outage.
 */
export function PixPausedScreen({
    route,
    action,
}: {
    route: CapabilityRoute | undefined
    action: 'deposits' | 'withdrawals'
}) {
    if (route?.reason?.code === 'residence_paused') return <BrazilPausedScreen />
    return <MantecaTransfersMaintenanceView action={action} />
}
