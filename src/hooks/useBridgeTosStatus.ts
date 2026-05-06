import { useMemo } from 'react'
import { useUserStore } from '@/redux/hooks'
import { type IUserRail } from '@/interfaces'

// derives bridge ToS status from the user's rails array
export const useBridgeTosStatus = () => {
    const { user } = useUserStore()

    return useMemo(() => {
        const rails: IUserRail[] = user?.rails ?? []
        const bridgeRails = rails.filter((r) => r.rail.provider.code === 'BRIDGE')

        const hasRequiresInformation = bridgeRails.some((r) => r.status === 'REQUIRES_INFORMATION')

        // bridge can require tos_acceptance as part of additionalRequirements
        // even when rails are in other states (REJECTED, REQUIRES_EXTRA_INFORMATION)
        const hasTosInRequirements = bridgeRails.some((r) => {
            const reqs = r.metadata?.additionalRequirements as string[] | undefined
            return reqs?.some((req) => req === 'tos_acceptance' || req === 'tos_v2_acceptance')
        })

        const needsBridgeTos = hasRequiresInformation || hasTosInRequirements
        const isBridgeFullyEnabled = bridgeRails.length > 0 && bridgeRails.every((r) => r.status === 'ENABLED')

        return { needsBridgeTos, isBridgeFullyEnabled, bridgeRails }
    }, [user?.rails])
}
