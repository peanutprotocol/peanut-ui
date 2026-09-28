'use client'

import { useCallback, useState, type ReactNode } from 'react'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { useEeaUpliftFunnel } from '@/hooks/useEeaUpliftFunnel'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import type { NextAction } from '@/types/capabilities'
import { upliftTriggerFromAdvisory } from '@/utils/eea-uplift.utils'

/**
 * Starts a future-dated document request (a Bridge advisory Sumsub step) from
 * wherever the request is shown: the task card or the Home carousel slide.
 *
 * `modals` must stay mounted after the request disappears from the list, so a
 * flow in progress survives the capability refetch. `error` is set only after
 * a start this hook made has failed, so the caller can show it and never leave
 * a tap as a silent no-op.
 */
export function useDocumentRequestFlow(): {
    start: (task: NextAction) => void
    /** key of the request the user last started */
    startedTaskKey: string | null
    isLoading: boolean
    error: string | null
    modals: ReactNode
} {
    const [startedTaskKey, setStartedTaskKey] = useState<string | null>(null)
    const {
        trackStarted: trackUpliftStarted,
        trackCompleted: trackUpliftCompleted,
        reset: resetUpliftFunnel,
    } = useEeaUpliftFunnel('verification-tasks')
    const kycFlow = useMultiPhaseKycFlow({
        onKycApproved: () => trackUpliftCompleted(),
        onManualClose: resetUpliftFunnel,
    })
    const { handleSelfHealResubmit } = kycFlow

    const start = useCallback(
        (task: NextAction) => {
            setStartedTaskKey(task.key)
            const upliftTrigger = task.effectiveDate
                ? upliftTriggerFromAdvisory({
                      effectiveDate: task.effectiveDate,
                      actionKey: task.key,
                      requirementKey: task.requirementKey,
                  })
                : null
            if (upliftTrigger) trackUpliftStarted(upliftTrigger)
            // The self-heal resubmit route tags the action so the completed
            // submission reaches the payment partner; a plain start-action token
            // would drop the answers.
            void handleSelfHealResubmit('BRIDGE', task.requirementKey)
        },
        [handleSelfHealResubmit, trackUpliftStarted]
    )

    return {
        start,
        startedTaskKey,
        isLoading: kycFlow.isLoading,
        error: startedTaskKey && !kycFlow.isLoading ? kycFlow.error : null,
        modals: <SumsubKycModals flow={kycFlow} />,
    }
}
