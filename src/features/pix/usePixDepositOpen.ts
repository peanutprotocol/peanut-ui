'use client'

import { useCapabilities } from '@/hooks/useCapabilities'
import { findPixRoute, pixDepositOffered } from '@/features/pix/pixRoute.utils'

/** Whether the Add money drawer offers Pix to this user: their Pix deposit route is Bridge's (`pixDepositOffered`). */
export function usePixDepositOpen(): boolean {
    const { capabilities } = useCapabilities()
    return pixDepositOffered(findPixRoute(capabilities.routes, 'deposit'))
}
