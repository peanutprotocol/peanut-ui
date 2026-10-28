'use client'

import { useQuery } from '@tanstack/react-query'
import { findKycDocumentPlan } from '@/app/actions/kyc-workflow'
import type { KycFeatures } from '@/app/actions/types/kyc-workflow.types'
import { useAuth } from '@/context/authContext'
import { PAPERWORK_VERIFICATION_PLAN_QUERY_KEY } from './usePaperworkVerificationStart'

/**
 * The features the user asked for (at sign-up, or added later), from the same
 * plan read Home loads. Null until it loads, or when it cannot be read.
 */
export function useRequestedKycFeatures(): KycFeatures | null {
    const { userId } = useAuth()
    const { data } = useQuery({
        queryKey: PAPERWORK_VERIFICATION_PLAN_QUERY_KEY,
        queryFn: () => findKycDocumentPlan('home'),
        enabled: !!userId,
        staleTime: 30_000,
        retry: false,
    })
    return data?.features ?? null
}
