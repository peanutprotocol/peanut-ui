'use client'

import { useAuth } from '@/context/authContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { rhinoApi } from '@/services/rhino'
import type { RhinoChainType } from '@/services/services.types'
import { useQuery } from '@tanstack/react-query'

/**
 * The user's own Rhino deposit address for one network. The add-money crypto page and the card's
 * add-money drawer read the same query, so the address is created once per network and user.
 */
export function useRhinoDepositAddress(network: RhinoChainType, enabled: boolean) {
    const { user } = useAuth()
    const userId = user?.user.userId
    const { address } = useWallet()
    return useQuery({
        queryKey: ['rhino-deposit-address', userId, address, network],
        queryFn: () => rhinoApi.createDepositAddress(address as string, network, userId as string),
        enabled: enabled && !!userId && !!address,
        staleTime: 1000 * 60 * 60 * 24, // 24 hours
    })
}
