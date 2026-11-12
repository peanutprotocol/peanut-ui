'use client'

import { useCapabilities } from '@/hooks/useCapabilities'
import { findPixRoute, pixRouteOpen } from '@/features/pix/pixRoute.utils'

/** Whether the Add money drawer offers Pix to this user: the Pix deposit route exists and is not refused (`pixRouteOpen`). */
export function usePixDepositOpen(): boolean {
    const { capabilities } = useCapabilities()
    return pixRouteOpen(findPixRoute(capabilities.routes, 'deposit'))
}
