'use client'

import { useCapabilities } from '@/hooks/useCapabilities'
import { findPixRoute, pixDepositOffered } from '@/features/pix/pixRoute.utils'

/** Whether the Add money drawer offers Pix to this user: a provider serves their Pix deposits (`pixDepositOffered`). */
export function usePixDepositOpen(): boolean {
    const { capabilities } = useCapabilities()
    return pixDepositOffered(findPixRoute(capabilities.routes, 'deposit'))
}
