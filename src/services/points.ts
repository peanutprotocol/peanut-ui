import { type CalculatePointsRequest, PointsAction, type TierInfo } from './services.types'
import { serverFetch } from '@/utils/api-fetch'

// Once per session: repeated previews would otherwise flood the console (and
// Sentry via captureConsole) with the same failure.
let calculatePointsFailureLogged = false
const logCalculatePointsFailureOnce = (detail: unknown) => {
    if (calculatePointsFailureLogged) return
    calculatePointsFailureLogged = true
    console.error('calculatePoints: preview failed, degrading to no points estimate', detail)
}

/** P2P payment edge between two users */
type P2PEdge = {
    source: string
    target: string
    type: 'SEND_LINK' | 'REQUEST_PAYMENT' | 'DIRECT_TRANSFER'
    bidirectional: boolean
    count?: number
    totalUsd?: number
}

type InvitesGraphResponse = {
    success: boolean
    data: {
        nodes: Array<{
            id: string
            username: string
            hasAppAccess: boolean
            directPoints?: number
            transitivePoints?: number
            totalPoints?: number
            createdAt?: string
            lastActiveAt?: string | null
            kycRegions: string[] | null
        }>
        edges: Array<{
            id: string
            source: string
            target: string
            type: 'DIRECT' | 'PAYMENT_LINK'
            createdAt: string
        }>
        p2pEdges: P2PEdge[]
        stats: {
            totalNodes: number
            totalEdges: number
            totalP2PEdges: number
            usersWithAccess: number
            orphans: number
        }
    } | null
    error?: string
}

async function fetchInvitesGraph(endpoint: string): Promise<InvitesGraphResponse> {
    try {
        const response = await serverFetch(endpoint, {
            method: 'GET',
            timeoutMs: 30_000, // large graph data can be slow
        })

        if (!response.ok) {
            console.error('getUserInvitesGraph: API request failed', response.status, response.statusText)
            return { success: false, data: null, error: 'Failed to load invite graph. Please try again.' }
        }

        const data = await response.json()
        return { success: true, data }
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            console.error('getUserInvitesGraph: Request timeout after 30s')
            return { success: false, data: null, error: 'Request timeout. The graph is too large.' }
        } else {
            console.error('getUserInvitesGraph: Unexpected error', error)
            return { success: false, data: null, error: 'Unexpected error loading graph.' }
        }
    }
}

export const pointsApi = {
    getTierInfo: async (): Promise<{ success: boolean; data: TierInfo | null }> => {
        try {
            const response = await serverFetch('/points', {
                method: 'GET',
            })
            if (!response.ok) {
                console.error('getTierInfo: API request failed', response.status, response.statusText)
                return { success: false, data: null }
            }

            const pointsInfo: TierInfo = await response.json()
            return { success: true, data: pointsInfo }
        } catch (error) {
            console.error('getTierInfo: Unexpected error', error)
            return { success: false, data: null }
        }
    },

    calculatePoints: async ({
        actionType,
        usdAmount,
        otherUserId,
    }: CalculatePointsRequest): Promise<{ estimatedPoints: number } | null> => {
        // Preview-only endpoint: a failure resolves to null so points UI degrades
        // silently and can never block a payment flow.
        try {
            const body: { actionType: PointsAction; usdAmount: number; otherUserId?: string } = {
                actionType,
                usdAmount,
            }

            if (otherUserId) {
                body.otherUserId = otherUserId
            }

            const response = await serverFetch('/points/calculate', {
                method: 'POST',
                body: JSON.stringify(body),
            })

            if (!response.ok) {
                logCalculatePointsFailureOnce(`API request failed: ${response.status} for action ${actionType}`)
                return null
            }

            const data = await response.json()

            return { estimatedPoints: data.estimatedPoints }
        } catch (error) {
            logCalculatePointsFailureOnce(error)
            return null
        }
    },

    getUserInvitesGraph: async (): Promise<InvitesGraphResponse> => {
        return fetchInvitesGraph('/invites/user-graph')
    },

    getCashStatus: async (): Promise<{
        success: boolean
        data: {
            hasCashbackLeft: boolean
            lifetimeEarned: number
            lifetimeBreakdown: {
                cashback: number
                inviterRewards: number
                withdrawPerks: number
                depositPerks: number
                other: number
            }
            /** rewards v2 fields — present once backend ships */
            rewards?: {
                pendingUsd: number
                lifetimeEarnedUsd: number
            }
        } | null
    }> => {
        try {
            const response = await serverFetch('/points/cash-status', {
                method: 'GET',
            })
            if (!response.ok) {
                console.error('getCashStatus: API request failed', response.status, response.statusText)
                return { success: false, data: null }
            }

            const data = await response.json()
            return { success: true, data }
        } catch (error) {
            console.error('getCashStatus: Unexpected error', error)
            return { success: false, data: null }
        }
    },
}
