import Cookies from 'js-cookie'
import { type CalculatePointsRequest, PointsAction, type TierInfo } from './services.types'
import { fetchWithSentry } from '@/utils/sentry.utils'
import { PEANUT_API_URL } from '@/constants/general.consts'

/** Qualitative labels for anonymized data */
export type FrequencyLabel = 'rare' | 'occasional' | 'regular' | 'frequent'
export type VolumeLabel = 'small' | 'medium' | 'large' | 'whale'
export type SizeLabel = 'tiny' | 'small' | 'medium' | 'large' | 'huge'

/** P2P edge - can be full (with counts) or anonymized (with labels) */
export type P2PEdge = {
    source: string
    target: string
    type: 'SEND_LINK' | 'REQUEST_PAYMENT' | 'DIRECT_TRANSFER'
    bidirectional: boolean
    // Full mode (exact values) - optional in anonymized mode
    count?: number
    totalUsd?: number
    // Anonymized mode (qualitative labels) - optional in full mode
    frequency?: FrequencyLabel
    volume?: VolumeLabel
}

type InvitesGraphResponse = {
    success: boolean
    data: {
        nodes: Array<{
            id: string
            username: string
            hasAppAccess: boolean
            // Full mode fields - optional in payment mode
            directPoints?: number
            transitivePoints?: number
            totalPoints?: number
            createdAt?: string
            lastActiveAt?: string | null
            // Payment mode fields - optional in full mode
            size?: SizeLabel
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

/** External node types for payment destinations outside our user base */
export type ExternalNodeType = 'WALLET' | 'BANK' | 'MERCHANT'

/** Direction of payment flow for external nodes */
export type ExternalDirection = 'INCOMING' | 'OUTGOING'

/** Per-user transaction data with direction
 * Supports both full mode (with exact values) and anonymized mode (with labels)
 */
export type UserTxDataEntry = {
    direction: ExternalDirection
    // Full mode (exact values) - optional in anonymized mode
    txCount?: number
    totalUsd?: number
    // Anonymized mode (qualitative labels) - optional in full mode
    frequency?: FrequencyLabel
    volume?: VolumeLabel
}

/** External payment destination node
 * Supports both full mode and anonymized mode with optional fields
 */
export type ExternalNode = {
    id: string
    type: ExternalNodeType
    label: string
    userTxData: Record<string, UserTxDataEntry>
    // Full mode fields - optional in anonymized mode
    uniqueUsers?: number
    userIds?: string[]
    txCount?: number
    totalUsd?: number
    lastTxDate?: string
    // Anonymized mode fields - optional in full mode
    size?: SizeLabel
    frequency?: FrequencyLabel
    volume?: VolumeLabel
}

type ExternalNodesResponse = {
    success: boolean
    data: {
        nodes: ExternalNode[]
        stats: {
            total: number
            byType: {
                WALLET: number
                BANK: number
                MERCHANT: number
            }
            totalTxCount?: number
            totalVolumeUsd?: number
        }
    } | null
    error?: string
}

async function fetchInvitesGraph(
    endpoint: string,
    extraHeaders?: Record<string, string>,
    handleStatusError?: (status: number) => string | null,
    requiresAuth: boolean = true
): Promise<InvitesGraphResponse> {
    try {
        // Get JWT token for user authentication (optional in payment mode)
        const jwtToken = Cookies.get('jwt-token')
        if (requiresAuth && !jwtToken) {
            console.error('getInvitesGraph: No JWT token found')
            return { success: false, data: null, error: 'Not authenticated. Please log in.' }
        }

        // Add 30s timeout for large graph data
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000)

        // Build headers - JWT is optional when requiresAuth is false
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...extraHeaders,
        }
        if (jwtToken) {
            headers['Authorization'] = `Bearer ${jwtToken}`
        }

        const response = await fetchWithSentry(`${PEANUT_API_URL}${endpoint}`, {
            method: 'GET',
            headers,
            signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
            console.error('getInvitesGraph: API request failed', response.status, response.statusText)

            // Handle custom status errors if provided
            const customError = handleStatusError?.(response.status)
            if (customError) {
                return { success: false, data: null, error: customError }
            }

            return { success: false, data: null, error: 'Failed to load invite graph. Please try again.' }
        }

        const data = await response.json()
        return { success: true, data }
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            console.error('getInvitesGraph: Request timeout after 30s')
            return { success: false, data: null, error: 'Request timeout. The graph is too large.' }
        } else {
            console.error('getInvitesGraph: Unexpected error', error)
            return { success: false, data: null, error: 'Unexpected error loading graph.' }
        }
    }
}

export const pointsApi = {
    getTierInfo: async (): Promise<{ success: boolean; data: TierInfo | null }> => {
        try {
            const jwtToken = Cookies.get('jwt-token')
            if (!jwtToken) {
                console.error('getTierInfo: No JWT token found')
                return { success: false, data: null }
            }

            const response = await fetchWithSentry(`${PEANUT_API_URL}/points`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${jwtToken}`,
                    'Content-Type': 'application/json',
                },
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
    }: CalculatePointsRequest): Promise<{ estimatedPoints: number }> => {
        try {
            const jwtToken = Cookies.get('jwt-token')

            if (!jwtToken) {
                const error = new Error('No JWT token found')
                console.error('calculatePoints: No JWT token found')
                throw error
            }

            const body: { actionType: PointsAction; usdAmount: number; otherUserId?: string } = {
                actionType,
                usdAmount,
            }

            if (otherUserId) {
                body.otherUserId = otherUserId
            }

            const response = await fetchWithSentry(`${PEANUT_API_URL}/points/calculate`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${jwtToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            })

            if (!response.ok) {
                console.error(
                    'calculatePoints: API request failed',
                    response.status,
                    response.statusText,
                    'for action',
                    actionType
                )
                throw new Error(`Failed to calculate points: ${response.status}`)
            }

            const data = await response.json()

            return { estimatedPoints: data.estimatedPoints }
        } catch (error) {
            console.error('calculatePoints: Unexpected error', error)
            throw error instanceof Error ? error : new Error('Failed to calculate points')
        }
    },

    getTimeLeaderboard: async (params?: {
        limit?: number
        since?: string
    }): Promise<{
        success: boolean
        data: {
            leaderboard: Array<{
                rank: number
                userId: string
                username: string
                pointsEarned: number
                currentTier: number
            }>
            since: string
            limit: number
        } | null
    }> => {
        try {
            const queryParams = new URLSearchParams()
            if (params?.limit) queryParams.append('limit', params.limit.toString())
            if (params?.since) queryParams.append('since', params.since)

            const response = await fetchWithSentry(
                `${PEANUT_API_URL}/points/time-leaderboard?${queryParams.toString()}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            )

            if (!response.ok) {
                console.error('getTimeLeaderboard: API request failed', response.status, response.statusText)
                return { success: false, data: null }
            }

            const data = await response.json()
            return { success: true, data }
        } catch (error) {
            console.error('getTimeLeaderboard: Unexpected error', error)
            return { success: false, data: null }
        }
    },

    getInvitesGraph: async (
        apiKey: string,
        options?: { mode?: 'full' | 'payment'; topNodes?: number; password?: string }
    ): Promise<InvitesGraphResponse> => {
        const isPaymentMode = options?.mode === 'payment'
        const params = new URLSearchParams()
        if (isPaymentMode) {
            params.set('mode', 'payment')
        }
        if (options?.topNodes && options.topNodes > 0) {
            params.set('topNodes', options.topNodes.toString())
        }
        if (options?.password) {
            params.set('password', options.password)
        }
        const endpoint = `/invites/graph${params.toString() ? `?${params}` : ''}`
        // Payment mode uses password auth (no API key needed), full mode requires API key + JWT
        const headers: Record<string, string> = isPaymentMode ? {} : { 'api-key': apiKey }
        return fetchInvitesGraph(
            endpoint,
            headers,
            (status) => {
                if (status === 403) {
                    return 'Access denied. Only authorized users can access this tool.'
                } else if (status === 401) {
                    return isPaymentMode ? 'Invalid or missing password.' : 'Invalid API key or authentication token.'
                }
                return null
            },
            !isPaymentMode // requiresAuth = false for payment mode
        )
    },

    getUserInvitesGraph: async (): Promise<InvitesGraphResponse> => {
        return fetchInvitesGraph('/invites/user-graph')
    },

    getCashStatus: async (): Promise<{
        success: boolean
        data: {
            cashbackAllowance: number | null
            lifetimeEarned: number
            lifetimeBreakdown: {
                cashback: number
                inviterRewards: number
                withdrawPerks: number
                depositPerks: number
                other: number
            }
        } | null
    }> => {
        try {
            const jwtToken = Cookies.get('jwt-token')
            if (!jwtToken) {
                console.error('getCashStatus: No JWT token found')
                return { success: false, data: null }
            }

            const response = await fetchWithSentry(`${PEANUT_API_URL}/points/cash-status`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${jwtToken}`,
                    'Content-Type': 'application/json',
                },
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

    getExternalNodes: async (
        apiKey: string,
        options?: {
            mode?: 'full' | 'payment'
            minConnections?: number
            types?: ExternalNodeType[]
            limit?: number
            topNodes?: number
            password?: string
        }
    ): Promise<ExternalNodesResponse> => {
        try {
            const jwtToken = Cookies.get('jwt-token')
            // Payment mode uses password auth, full mode requires JWT
            const isPaymentMode = options?.mode === 'payment'
            if (!isPaymentMode && !jwtToken) {
                return { success: false, data: null, error: 'Not authenticated. Please log in.' }
            }

            // Build query params
            const params = new URLSearchParams()
            if (options?.mode) {
                params.set('mode', options.mode)
            }
            if (options?.minConnections) {
                params.set('minConnections', options.minConnections.toString())
            }
            if (options?.types?.length) {
                params.set('types', options.types.join(','))
            }
            if (options?.limit) {
                params.set('limit', options.limit.toString())
            }
            if (options?.topNodes && options.topNodes > 0) {
                params.set('topNodes', options.topNodes.toString())
            }
            // Password is required for payment mode
            if (options?.password) {
                params.set('password', options.password)
            }

            const url = `${PEANUT_API_URL}/invites/graph/external${params.toString() ? `?${params}` : ''}`

            // Build headers:
            // - Payment mode: no API key required (uses password auth)
            // - Full mode: API key + JWT required
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            }
            if (!isPaymentMode) {
                headers['api-key'] = apiKey
            }
            if (jwtToken) {
                headers['Authorization'] = `Bearer ${jwtToken}`
            }

            const response = await fetchWithSentry(url, {
                method: 'GET',
                headers,
            })

            if (!response.ok) {
                if (response.status === 403) {
                    return { success: false, data: null, error: 'Access denied.' }
                }
                return { success: false, data: null, error: 'Failed to load external nodes.' }
            }

            const data = await response.json()
            return { success: true, data }
        } catch (error) {
            console.error('getExternalNodes: Unexpected error', error)
            return { success: false, data: null, error: 'Unexpected error loading external nodes.' }
        }
    },
}
