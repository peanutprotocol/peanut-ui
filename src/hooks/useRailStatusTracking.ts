import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useUserStore } from '@/redux/hooks'
import { useAuth } from '@/context/authContext'
import { useWebSocket } from '@/hooks/useWebSocket'
import { type IUserRail, type ProviderDisplayStatus, type ProviderStatus } from '@/interfaces'
import { type RailStatusUpdate } from '@/services/websocket'

interface RailStatusTrackingResult {
    providers: ProviderStatus[]
    allSettled: boolean
    needsBridgeTos: boolean
    startTracking: () => void
    stopTracking: () => void
}

const POLL_INTERVAL_MS = 4000

// human-readable labels for provider groups
const PROVIDER_LABELS: Record<string, string> = {
    BRIDGE: 'Bank transfers',
    MANTECA: 'QR payments',
}

function deriveProviderDisplayName(providerCode: string, rails: IUserRail[]): string {
    const base = PROVIDER_LABELS[providerCode] ?? providerCode
    // add country context from rail methods
    const countries = [...new Set(rails.map((r) => r.rail.method.country).filter(Boolean))]
    if (countries.length > 0) {
        return `${base} (${countries.join(', ')})`
    }
    return base
}

function deriveStatus(rail: IUserRail): ProviderDisplayStatus {
    switch (rail.status) {
        case 'ENABLED':
            return 'enabled'
        case 'REQUIRES_INFORMATION':
        case 'REQUIRES_EXTRA_INFORMATION':
            return 'requires_tos'
        case 'FAILED':
        case 'REJECTED':
            return 'failed'
        case 'PENDING':
        default:
            return 'setting_up'
    }
}

// pick the "most advanced" status for a provider group
function deriveGroupStatus(rails: IUserRail[]): ProviderDisplayStatus {
    const statuses = rails.map(deriveStatus)
    // priority: requires_tos > enabled > failed > setting_up
    if (statuses.includes('requires_tos')) return 'requires_tos'
    if (statuses.includes('enabled')) return 'enabled'
    if (statuses.includes('failed')) return 'failed'
    return 'setting_up'
}

export const useRailStatusTracking = (): RailStatusTrackingResult => {
    const { user } = useUserStore()
    const { fetchUser } = useAuth()
    const [isTracking, setIsTracking] = useState(false)
    const pollTimerRef = useRef<NodeJS.Timeout | null>(null)
    const isMountedRef = useRef(true)

    // listen for rail status WebSocket events
    useWebSocket({
        username: user?.user.username ?? undefined,
        autoConnect: isTracking,
        onRailStatusUpdate: useCallback(
            (_data: RailStatusUpdate) => {
                // refetch user to get updated rails from server
                if (isTracking) {
                    fetchUser()
                }
            },
            [isTracking, fetchUser]
        ),
    })

    // derive provider statuses from current rails
    const providers = useMemo((): ProviderStatus[] => {
        const rails: IUserRail[] = user?.rails ?? []
        if (rails.length === 0) return []

        // group by provider
        const byProvider = new Map<string, IUserRail[]>()
        for (const rail of rails) {
            const code = rail.rail.provider.code
            const list = byProvider.get(code) ?? []
            list.push(rail)
            byProvider.set(code, list)
        }

        return Array.from(byProvider.entries()).map(([code, providerRails]) => ({
            providerCode: code,
            displayName: deriveProviderDisplayName(code, providerRails),
            status: deriveGroupStatus(providerRails),
            rails: providerRails,
        }))
    }, [user?.rails])

    const allSettled = useMemo(() => {
        if (providers.length === 0) return false
        return providers.every((p) => p.status !== 'setting_up')
    }, [providers])

    const needsBridgeTos = useMemo(() => {
        return providers.some((p) => p.providerCode === 'BRIDGE' && p.status === 'requires_tos')
    }, [providers])

    // stop polling when all settled
    useEffect(() => {
        if (allSettled && isTracking) {
            if (pollTimerRef.current) {
                clearInterval(pollTimerRef.current)
                pollTimerRef.current = null
            }
        }
    }, [allSettled, isTracking])

    const startTracking = useCallback(() => {
        setIsTracking(true)

        // start polling as fallback
        if (pollTimerRef.current) clearInterval(pollTimerRef.current)
        pollTimerRef.current = setInterval(() => {
            if (isMountedRef.current) {
                fetchUser()
            }
        }, POLL_INTERVAL_MS)
    }, [fetchUser])

    const stopTracking = useCallback(() => {
        setIsTracking(false)
        if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current)
            pollTimerRef.current = null
        }
    }, [])

    // cleanup on unmount
    useEffect(() => {
        isMountedRef.current = true
        return () => {
            isMountedRef.current = false
            if (pollTimerRef.current) {
                clearInterval(pollTimerRef.current)
                pollTimerRef.current = null
            }
        }
    }, [])

    return {
        providers,
        allSettled,
        needsBridgeTos,
        startTracking,
        stopTracking,
    }
}
