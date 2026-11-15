'use client'
import { useOptionalAuth } from '@/context/authContext'
import type { ProviderId } from '@/types/provider.types'
import { bridgeProviderIdForResidence } from '@/utils/provider.utils'

/** The Bridge entity record for the signed-in user's verified residence. */
export function useBridgeProviderId(): ProviderId {
    return bridgeProviderIdForResidence(useOptionalAuth()?.user?.residence?.verified?.country)
}
