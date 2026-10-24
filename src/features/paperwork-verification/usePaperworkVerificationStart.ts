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
 * region-restricted ID) keep it in front.
 *
 * A plan that cannot be read goes to /verify too, never to the start modal: its
 * Verify would open a legacy applicant, which shuts a Smart Paperwork
 * Verification user out of that flow for good. /verify reads the plan again,
 * shows its retry screen if it still fails, and sends anyone the server keeps
 * on today's flow back Home.
 */
export function usePaperworkVerificationStart(): () => Promise<boolean> {
    const degraded = useKycDegraded()
    const { isRegionRestricted } = useIdentityVerification()
    const queryClient = useQueryClient()
    // Loads the plan with Home, so most taps resolve from the cache. The read retries itself.
    useQuery({
        queryKey: PAPERWORK_VERIFICATION_PLAN_QUERY_KEY,
        queryFn: () => findKycDocumentPlan('home'),
        staleTime: PLAN_STALE_MS,
        retry: false,
    })
    return useCallback(async () => {
        if (degraded || isRegionRestricted) return false
        try {
            const plan = await queryClient.fetchQuery({
                queryKey: PAPERWORK_VERIFICATION_PLAN_QUERY_KEY,
                queryFn: () => findKycDocumentPlan('home'),
                staleTime: PLAN_STALE_MS,
                retry: false,
            })
            return plan?.flow === PAPERWORK_VERIFICATION_FLOW
        } catch {
            return true
        }
    }, [degraded, isRegionRestricted, queryClient])
}
