'use client'

import { useEffect, useRef } from 'react'
import type { KycFeatureActivationResult } from '@/app/actions/kyc-feature-activation'
import Loading from '@/components/Global/Loading'
import { DEPOSIT_RAILS } from '@/features/deposit-accounts/rails'
import type { DepositCorridor } from '@/features/deposit-accounts/types'
import { useDepositGateRemediation } from '@/features/deposit-accounts/useDepositGateRemediation'
import { VerificationOutage } from '@/features/paperwork-verification/components/LoadScreens'
import { KycFeatureActivationStatus } from '@/features/paperwork-verification/KycFeatureActivationStatus'
import { useKycFeatureActivation } from '@/features/paperwork-verification/useKycFeatureActivation'
import { PixReviewScreen } from '@/features/pix/components/PixReviewScreen'
import { PIX_COUNTRY } from '@/features/pix/pixRoute.utils'
import { useKycDegraded } from '@/hooks/useKycDegraded'

/** The BRL account the first use opens, as the account screens scope it. */
const PIX_ACCOUNT_SCOPE = { channel: 'bank', country: PIX_COUNTRY } as const
/** A first use that waits on the verification of a corridor names it `verify-corridor:<method>` (api `corridors.ts`). */
const CORRIDOR_STEP_PREFIX = 'verify-corridor:'

/** The corridor a first use answered it waits on, where the answer names one. */
function corridorToVerify(result: KycFeatureActivationResult | null): DepositCorridor | undefined {
    if (result?.kind !== 'report' || result.report.state !== 'action_required') return undefined
    const key = result.report.nextAction?.key
    if (!key?.startsWith(CORRIDOR_STEP_PREFIX)) return undefined
    const corridor = key.slice(CORRIDOR_STEP_PREFIX.length).toUpperCase()
    return corridor in DEPOSIT_RAILS ? (corridor as DepositCorridor) : undefined
}

/**
 * The first use of Pix (the route's `activate`): one call for every user, whatever verified them,
 * `POST /users/kyc/features/local/activate` (API-CONTRACT.md 4a). The API answers each user with
 * their step. A legacy approval waits on its corridor's verification (`verify-corridor:pix_br`),
 * which starts the way the bank deposit flow starts one (`useDepositGateRemediation`:
 * `POST /users/identity` with the corridor and `crossRegion`), over this page, so the user is back
 * here when it closes. A wait shows the review screen, never a loader with no end. Once the
 * provider's rail exists the route moves on, and the Pix setup shows what it says next.
 */
export function PixFirstUse({ title, onBack }: { title: string; onBack: () => void }) {
    const degraded = useKycDegraded()
    const activation = useKycFeatureActivation('local', {
        scope: PIX_ACCOUNT_SCOPE,
        enabled: !degraded,
        everyUser: true,
    })
    const { resolveGate, modals } = useDepositGateRemediation()
    const corridor = corridorToVerify(activation.result)
    // the verification opens once per answer; the page's button opens it again after a dismiss
    const openedFor = useRef<KycFeatureActivationResult | null>(null)
    useEffect(() => {
        if (!corridor || openedFor.current === activation.result) return
        openedFor.current = activation.result
        resolveGate({ kind: 'needs-enrollment' }, corridor)
    }, [corridor, activation.result, resolveGate])

    if (degraded) return <VerificationOutage onBack={onBack} />
    if (!activation.userReady) return <Loading variant="mascot" />
    const waiting =
        activation.result?.kind === 'report' &&
        (activation.result.report.state === 'pending' || activation.result.report.state === 'setting_up')
    // Allowed and still here: the provider is opening the account, and the route moves on once it is open.
    if (activation.allowed || waiting) return <PixReviewScreen title={title} onBack={onBack} />
    return (
        <>
            <KycFeatureActivationStatus
                feature="local"
                // with a corridor to verify, the page offers that verification under its own button
                result={corridor ? null : activation.result}
                isLoading={activation.isLoading}
                onRetry={() =>
                    corridor ? resolveGate({ kind: 'needs-enrollment' }, corridor) : void activation.activate()
                }
                onBack={onBack}
            />
            {modals}
        </>
    )
}
