'use client'

import { useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query'
import { getKycQuestions } from '@/app/actions/kyc-paperwork-verification'
import { findKycDocumentPlan, getKycDocumentStatus } from '@/app/actions/kyc-workflow'
import { PAPERWORK_VERIFICATION_FLOW, type KycDocumentPlan } from '@/app/actions/types/kyc-workflow.types'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { useKycDegraded } from '@/hooks/useKycDegraded'
import { useOptionalAuth } from '@/context/authContext'

export const PAPERWORK_VERIFICATION_PLAN_QUERY_KEY = ['kyc-plan', 'paperwork-verification'] as const
export const PAPERWORK_VERIFICATION_QUESTIONS_QUERY_KEY = ['kyc-questions', 'paperwork-verification'] as const
export const PAPERWORK_VERIFICATION_STATUS_QUERY_KEY = ['kyc-status', 'paperwork-verification'] as const
const PLAN_STALE_MS = 30_000
// Answers stay in memory only; a short life keeps them from outliving the visit.
const QUESTIONS_GC_MS = 10 * 60_000

const opensFlow = (plan: KycDocumentPlan | null | undefined) =>
    plan?.flow === PAPERWORK_VERIFICATION_FLOW && !plan.needs?.length

/** Loads what /verify opens on, so it shows its first screen without a wait. */
export function prefetchPaperworkVerification(queryClient: QueryClient, userId?: string) {
    if (!userId) return
    void queryClient.prefetchQuery({
        queryKey: [...PAPERWORK_VERIFICATION_QUESTIONS_QUERY_KEY, userId],
        queryFn: () => getKycQuestions(),
        staleTime: PLAN_STALE_MS,
        gcTime: QUESTIONS_GC_MS,
    })
    void queryClient.prefetchQuery({
        queryKey: [...PAPERWORK_VERIFICATION_STATUS_QUERY_KEY, userId],
        queryFn: () => getKycDocumentStatus(),
        staleTime: PLAN_STALE_MS,
    })
}

/**
 * Resolves whether the Home Verify row opens /verify directly. Home reads the
 * plan, so a tap decides from it at once and refreshes it behind; only a tap
 * before the first read waits. The modal's own short-circuits (verification
 * outage, region-restricted ID) keep it in front.
 *
 * A plan that cannot be read keeps the start modal: its start asks the API,
 * which refuses a Smart Paperwork Verification user with
 * paperwork_verification_required and the start then opens /verify.
 */
export function usePaperworkVerificationStart(): () => Promise<boolean> {
    const userId = useOptionalAuth()?.user?.user.userId
    const degraded = useKycDegraded()
    const { isRegionRestricted } = useIdentityVerification()
    const queryClient = useQueryClient()
    const router = useRouter()
    // Loads the plan with Home, so most taps resolve from the cache. The read retries itself.
    const { data: plan } = useQuery({
        queryKey: [...PAPERWORK_VERIFICATION_PLAN_QUERY_KEY, userId],
        queryFn: () => findKycDocumentPlan('home'),
        staleTime: PLAN_STALE_MS,
        retry: false,
        enabled: !!userId,
    })
    const flowAhead = opensFlow(plan) && !degraded && !isRegionRestricted
    useEffect(() => {
        if (!flowAhead) return
        prefetchPaperworkVerification(queryClient, userId)
        router.prefetch('/verify')
    }, [flowAhead, queryClient, router, userId])
    return useCallback(async () => {
        if (!userId || degraded || isRegionRestricted) return false
        const key = [...PAPERWORK_VERIFICATION_PLAN_QUERY_KEY, userId]
        const cached = queryClient.getQueryData<KycDocumentPlan | null>(key)
        if (cached !== undefined) {
            void queryClient.invalidateQueries({ queryKey: key })
            return cached?.flow === PAPERWORK_VERIFICATION_FLOW
        }
        try {
            const fresh = await queryClient.fetchQuery({
                queryKey: key,
                queryFn: () => findKycDocumentPlan('home'),
                staleTime: PLAN_STALE_MS,
                retry: false,
            })
            return fresh?.flow === PAPERWORK_VERIFICATION_FLOW
        } catch {
            return false
        }
    }, [degraded, isRegionRestricted, queryClient, userId])
}
