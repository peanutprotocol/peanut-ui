'use client'

import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { findKycDocumentPlan } from '@/app/actions/kyc-workflow'
import { PAPERWORK_VERIFICATION_FLOW } from '@/app/actions/types/kyc-workflow.types'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { useKycDegraded } from '@/hooks/useKycDegraded'

export const PAPERWORK_VERIFICATION_PLAN_QUERY_KEY = ['kyc-plan', 'paperwork-verification'] as const
const PLAN_STALE_MS = 30_000

/**
 * Resolves whether the Home Verify row opens /verify directly. A tap before the
 * plan has loaded waits for it, so a Smart Paperwork Verification user never
 * sees the start modal. The modal's own short-circuits (verification outage,
 * region-restricted ID) keep it in front, and so does a plan that failed to load.
 */
export function usePaperworkVerificationStart(): () => Promise<boolean> {
    const degraded = useKycDegraded()
    const { isRegionRestricted } = useIdentityVerification()
    const queryClient = useQueryClient()
    // Loads the plan with Home, so most taps resolve from the cache.
    useQuery({
        queryKey: PAPERWORK_VERIFICATION_PLAN_QUERY_KEY,
        queryFn: () => findKycDocumentPlan(),
        staleTime: PLAN_STALE_MS,
    })
    return useCallback(async () => {
        if (degraded || isRegionRestricted) return false
        const plan = await queryClient
            .fetchQuery({
                queryKey: PAPERWORK_VERIFICATION_PLAN_QUERY_KEY,
                queryFn: () => findKycDocumentPlan(),
                staleTime: PLAN_STALE_MS,
            })
            .catch(() => null)
        return plan?.flow === PAPERWORK_VERIFICATION_FLOW
    }, [degraded, isRegionRestricted, queryClient])
}
