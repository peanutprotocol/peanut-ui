'use client'

import { useQuery } from '@tanstack/react-query'
import { findKycDocumentPlan } from '@/app/actions/kyc-workflow'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { useKycDegraded } from '@/hooks/useKycDegraded'

export const VERIFY_ONCE_PLAN_QUERY_KEY = ['kyc-plan', 'verify-once'] as const

/**
 * True when the Home Verify row can open /verify directly. The start modal's
 * own short-circuits (verification outage, region-restricted ID) keep it in
 * front; anything unknown also keeps the modal, whose Verify routes here too.
 */
export function useVerifyOnceStart(): boolean {
    const degraded = useKycDegraded()
    const { isRegionRestricted } = useIdentityVerification()
    const { data: plan } = useQuery({
        queryKey: VERIFY_ONCE_PLAN_QUERY_KEY,
        queryFn: () => findKycDocumentPlan(),
        staleTime: 30_000,
    })
    return !degraded && !isRegionRestricted && plan?.flow === 'verify-once'
}
