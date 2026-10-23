'use client'

import { useQuery } from '@tanstack/react-query'
import { findKycDocumentPlan } from '@/app/actions/kyc-workflow'
import { PAPERWORK_VERIFICATION_FLOW } from '@/app/actions/types/kyc-workflow.types'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { useKycDegraded } from '@/hooks/useKycDegraded'

export const PAPERWORK_VERIFICATION_PLAN_QUERY_KEY = ['kyc-plan', 'paperwork-verification'] as const

/**
 * True when the Home Verify row can open /verify directly. The start modal's
 * own short-circuits (verification outage, region-restricted ID) keep it in
 * front; anything unknown also keeps the modal, whose Verify routes here too.
 */
export function usePaperworkVerificationStart(): boolean {
    const degraded = useKycDegraded()
    const { isRegionRestricted } = useIdentityVerification()
    const { data: plan } = useQuery({
        queryKey: PAPERWORK_VERIFICATION_PLAN_QUERY_KEY,
        queryFn: () => findKycDocumentPlan(),
        staleTime: 30_000,
    })
    return !degraded && !isRegionRestricted && plan?.flow === PAPERWORK_VERIFICATION_FLOW
}
