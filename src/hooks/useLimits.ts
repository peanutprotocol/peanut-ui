'use client'

import { useQuery } from '@tanstack/react-query'
import Cookies from 'js-cookie'
import { fetchWithSentry } from '@/utils/sentry.utils'
import { PEANUT_API_URL } from '@/constants/general.consts'
import type { UserLimitsResponse } from '@/interfaces'
import { LIMITS } from '@/constants/query.consts'

interface UseLimitsOptions {
    enabled?: boolean
}

/**
 * hook to fetch user's fiat transaction limits
 * returns limits from both bridge (na/europe/mx) and manteca (latam) providers
 * returns null values if user hasn't completed respective kyc
 */
export function useLimits(options: UseLimitsOptions = {}) {
    const { enabled = true } = options

    const fetchLimits = async (): Promise<UserLimitsResponse> => {
        const url = `${PEANUT_API_URL}/users/limits`

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${Cookies.get('jwt-token')}`,
        }

        const response = await fetchWithSentry(url, { method: 'GET', headers })

        // 400 means user has no kyc - return empty limits
        if (response.status === 400) {
            return { manteca: null, bridge: null }
        }

        if (!response.ok) {
            throw new Error(`Failed to fetch limits: ${response.statusText}`)
        }

        return response.json()
    }

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: [LIMITS],
        queryFn: fetchLimits,
        enabled,
        staleTime: 5 * 60 * 1000, // 5 minutes - limits don't change often
        gcTime: 10 * 60 * 1000,
        refetchOnMount: true,
        refetchOnWindowFocus: true,
    })

    return {
        limits: data ?? null,
        bridgeLimits: data?.bridge ?? null,
        mantecaLimits: data?.manteca ?? null,
        isLoading,
        error,
        refetch,
        // convenience flags
        hasBridgeLimits: !!data?.bridge,
        hasMantecaLimits: !!data?.manteca && data.manteca.length > 0,
    }
}
