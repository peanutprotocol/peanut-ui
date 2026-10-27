'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useModalsContext } from '@/context/ModalsContext'
import { ADDITIONAL_VERIFICATION_ROUTE } from '@/constants/kyc.consts'
import type { KYCRegionIntent } from '@/app/actions/types/sumsub.types'
import type { DepositCorridor } from '@/features/deposit-accounts/types'
import type { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { gateRemedy, gateSupportCase, type GateState } from '@/utils/capability-gate'
import { buildSupportCaseMessage, SUPPORT_CASE_MESSAGE_KEYS } from '@/utils/contact-support.utils'
import { paperworkVerificationFeaturePath } from '@/features/paperwork-verification/paperworkVerificationEntry'

type GateFlow = Pick<
    ReturnType<typeof useMultiPhaseKycFlow>,
    'handleInitiateKyc' | 'handleRestartIdentity' | 'handleFixableGate'
>

/** What a fresh start needs: the provider whose fix it is, and where verification opens. */
export interface GateStart {
    provider: 'BRIDGE' | 'MANTECA'
    intent?: KYCRegionIntent
    targetCountry?: string
    corridor?: DepositCorridor
}

/**
 * The CTA behind every bank gate, in one place (see {@link gateRemedy}).
 *
 * Each bank surface used to carry its own copy of this dispatch, and the
 * copies drifted: one sent `restart-identity` into a fresh verification, all
 * of them sent Bridge's hosted check into a resubmit that cannot clear it.
 */
export function useGateActions(flow: GateFlow) {
    const router = useRouter()
    const { setIsSupportModalOpen, openSupportWithMessage } = useModalsContext()
    const t = useTranslations('kyc')
    const { handleInitiateKyc, handleRestartIdentity, handleFixableGate } = flow

    const verify = useCallback(
        async (gate: GateState, start: GateStart) => {
            const remedy = gateRemedy(gate)
            switch (remedy) {
                case 'restart-identity':
                    await handleRestartIdentity()
                    return
                case 'provider-fix':
                    if (gate.kind === 'fixable-rejection') await handleFixableGate(start.provider, gate)
                    return
                case 'hosted-check':
                    router.push(ADDITIONAL_VERIFICATION_ROUTE)
                    return
                case 'questions':
                    if (gate.kind === 'fixable-rejection' && gate.nextAction?.feature)
                        router.push(paperworkVerificationFeaturePath(gate.nextAction.feature))
                    return
                case 'verify':
                case 'enroll': {
                    const crossRegion = remedy === 'enroll' || undefined
                    await (start.corridor
                        ? handleInitiateKyc(start.intent, undefined, crossRegion, start.targetCountry, start.corridor)
                        : handleInitiateKyc(start.intent, undefined, crossRegion, start.targetCountry))
                    return
                }
                default:
                    // support, the email sheet, terms and waits have their own doors
                    return
            }
        },
        [router, handleInitiateKyc, handleRestartIdentity, handleFixableGate]
    )

    const contactSupport = useCallback(
        (gate: GateState) => {
            const supportCase = gateSupportCase(gate)
            if (!supportCase || gate.kind !== 'blocked-rejection') {
                setIsSupportModalOpen(true)
                return
            }
            openSupportWithMessage(
                buildSupportCaseMessage(supportCase, t(SUPPORT_CASE_MESSAGE_KEYS[supportCase]), gate.reason)
            )
        },
        [setIsSupportModalOpen, openSupportWithMessage, t]
    )

    return { verify, contactSupport }
}
