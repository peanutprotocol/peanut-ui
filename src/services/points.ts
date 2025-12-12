import Cookies from 'js-cookie'
import { type CalculatePointsRequest, PointsAction, type TierInfo } from './services.types'
import { fetchWithSentry } from '@/utils/sentry.utils'
import { PEANUT_API_URL } from '@/constants/general.consts'

type InvitesGraphResponse = {
    success: boolean
    data: {
        nodes: Array<{
            id: string
            username: string
            hasAppAccess: boolean
            directPoints: number
            transitivePoints: number
            totalPoints: number
        }>
        edges: Array<{
            id: string
            source: string
            target: string
            type: 'DIRECT' | 'PAYMENT_LINK'
            createdAt: string
        }>
        stats: {
            totalNodes: number
            totalEdges: number
            usersWithAccess: number
            orphans: number
        }
    } | null
    error?: string
}

const GRAPH_TIMEOUT_MS = 30000

async function fetchInvitesGraph(
    endpoint: string,
    extraHeaders?: Record<string, string>,
    handleStatusError?: (status: number) => string | null
): Promise<InvitesGraphResponse> {
    try {
        // Get JWT token for user authentication
        const jwtToken = Cookies.get('jwt-token')
        if (!jwtToken) {
            console.error('getInvitesGraph: No JWT token found')
            return { success: false, data: null, error: 'Not authenticated. Please log in.' }
        }

        const response = await fetchWithSentry(
            `${PEANUT_API_URL}${endpoint}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${jwtToken}`,
                    ...extraHeaders,
                },
            },
            GRAPH_TIMEOUT_MS // 30s timeout for large graph data
        )

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
        // fetchWithSentry throws a regular Error with timeout message, not AbortError
        if (error instanceof Error && error.message.includes('timed out')) {
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

    getInvitesGraph: async (apiKey: string): Promise<InvitesGraphResponse> => {
        return fetchInvitesGraph('/invites/graph', { 'api-key': apiKey }, (status) => {
            if (status === 403) {
                return 'Access denied. Only authorized users can access this tool.'
            } else if (status === 401) {
                return 'Invalid API key or authentication token.'
            }
            return null
        })
    },

    getUserInvitesGraph: async (): Promise<InvitesGraphResponse> => {
        return fetchInvitesGraph('/invites/user-graph')
    },
}
