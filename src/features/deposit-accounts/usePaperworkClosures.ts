'use client'

import { useAuth } from '@/context/authContext'
import { fetchKycPaperwork } from '@/services/kyc-paperwork'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { corridorsClosedByPaperwork } from './paperwork'
import type { DepositCorridor } from './types'
import { useResidenceIso2s } from './useResidenceIso2s'

export const KYC_PAPERWORK_QUERY_KEY = ['kyc-paperwork'] as const

/**
 * The corridors the Smart Paperwork Engine refuses this user's residence.
 *
 * Empty on any failure: the backend's own corridor answers still hold then,
 * and an API without the endpoint changes nothing. `isLoading` lets a list
 * wait for the first answer, so a refused row never shows "Verify ID" first.
 * The residence is in the key because the verdict is read from it, so a
 * residence change asks again.
 */
export function usePaperworkClosures({ enabled = true }: { enabled?: boolean } = {}): {
    closed: ReadonlySet<DepositCorridor>
    isLoading: boolean
} {
    const { userId } = useAuth()
    const residenceIso2s = useResidenceIso2s()
    const { data, isLoading } = useQuery({
        queryKey: [...KYC_PAPERWORK_QUERY_KEY, userId, residenceIso2s.join(',')],
        enabled: !!userId && enabled,
        queryFn: fetchKycPaperwork,
        staleTime: 5 * 60_000,
    })
    const closed = useMemo(() => corridorsClosedByPaperwork(data), [data])
    return { closed, isLoading }
}
