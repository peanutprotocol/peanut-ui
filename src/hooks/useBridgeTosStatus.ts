import { useMemo } from 'react'
import { useUserStore } from '@/redux/hooks'
import { type IUserRail } from '@/interfaces'

// derives bridge ToS status from the user's rails array
export const useBridgeTosStatus = () => {
    const { user } = useUserStore()

    return useMemo(() => {
        const rails: IUserRail[] = user?.rails ?? []
        const bridgeRails = rails.filter((r) => r.rail.provider.code === 'BRIDGE')
        const needsBridgeTos = bridgeRails.some((r) => r.status === 'REQUIRES_INFORMATION')
        const isBridgeFullyEnabled = bridgeRails.length > 0 && bridgeRails.every((r) => r.status === 'ENABLED')

        return { needsBridgeTos, isBridgeFullyEnabled, bridgeRails }
    }, [user?.rails])
}
