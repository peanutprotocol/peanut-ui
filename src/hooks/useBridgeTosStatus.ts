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
        // but only on non-ENABLED rails — ENABLED means tos was already accepted,
        // stale metadata should not re-trigger the tos modal
        const hasTosInRequirements = bridgeRails.some((r) => {
            if (r.status === 'ENABLED') return false
            const reqs = Array.isArray(r.metadata?.additionalRequirements)
                ? (r.metadata.additionalRequirements as string[])
                : []
            return reqs.some((req) => req === 'tos_acceptance' || req === 'tos_v2_acceptance')
        })

        const needsBridgeTos = hasRequiresInformation || hasTosInRequirements
        const isBridgeFullyEnabled = bridgeRails.length > 0 && bridgeRails.every((r) => r.status === 'ENABLED')

        return { needsBridgeTos, isBridgeFullyEnabled, bridgeRails }
    }, [user?.rails])
}
