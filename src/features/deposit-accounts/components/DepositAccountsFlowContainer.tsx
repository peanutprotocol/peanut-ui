'use client'

import { useAuth } from '@/context/authContext'
import { useModalsContext } from '@/context/ModalsContext'
import { corridorTopUpHref } from '@/features/add-money/countryRoutes'
import { rewriteMethodPath } from '@/utils/native-routes'
import { withReturnTo } from '@/utils/return-to.utils'
import { useRouter } from 'next/navigation'
import { DepositAccountsFlow } from './DepositAccountsFlow'
import type { DepositSupportReason } from '../types'
import { useDepositAccounts } from '../useDepositAccounts'
import { useDepositAccountsEnabled } from '../useDepositAccountsEnabled'
import { useDepositGateRemediation } from '../useDepositGateRemediation'
import { useResidenceIso2s } from '../useResidenceIso2s'
import { useEndorsementReview } from '../useEndorsementReview'

/** What support reads first. English on purpose: it is for the agent, not the user. */
const SUPPORT_SUBJECT: Record<DepositSupportReason, string> = {
    'account-limit': 'Another deposit account',
    blocked: "Couldn't open deposit account",
    revoked: 'Revoked deposit details',
    review: 'Extra check needed for deposit account',
}

interface DepositAccountsFlowContainerProps {
    /** leaving the flow entirely — each entry point decides where that goes */
    onExit: () => void
}

/**
 * The deposit-accounts flow with its data wired in.
 *
 * One route renders it — `/add-money?method=bank` — and the wiring lives here
 * rather than in the page, so the page passes nothing but where "back" goes.
 *
 * The step and the corridor stay in the URL, read by the flow itself, so a
 * caller navigates by setting `?corridor=` and `?step=` rather than by passing
 * state down.
 */
export function DepositAccountsFlowContainer({ onExit }: DepositAccountsFlowContainerProps) {
    // The flag gates opening an account, never reading one. Money keeps landing
    // on an account the user already handed out whatever the flag says — the
    // webhook and the poller are not gated — so the details and the revoked
    // state stay readable when the flag is off, which is also the rollback
    // lever. Only the claim step and the corridors on offer go dark.
    const claimsEnabled = useDepositAccountsEnabled()
    const { resolveGate, verifyCorridor, modals } = useDepositGateRemediation()
    const {
        corridors,
        accounts,
        claimable,
        unavailable,
        slotsHeld,
        accountLimit,
        gates,
        isLoading,
        isError,
        claimingCorridor,
        claimError,
        claim,
        refetch,
    } = useDepositAccounts({ onVerificationRequired: verifyCorridor })
    const { user } = useAuth()
    const router = useRouter()
    const residenceIso2s = useResidenceIso2s()
    const { openSupportWithMessage } = useModalsContext()
    const review = useEndorsementReview()

    return (
        <>
            <DepositAccountsFlow
                corridors={corridors}
                accounts={accounts}
                claimable={claimable}
                unavailable={unavailable}
                slotsHeld={slotsHeld}
                accountLimit={accountLimit}
                gates={gates}
                isLoading={isLoading}
                isError={isError}
                claimsEnabled={claimsEnabled}
                // the name a payer reads next to the details; the share copy only
                // uses it where the account is NOT in the user's own name
                userName={user?.user.fullName || user?.user.username || ''}
                claimingCorridor={claimingCorridor}
                claimError={claimError}
                onExit={onExit}
                onClaim={claim}
                onResolveGate={resolveGate}
                onRetry={refetch}
                // The conversations the app cannot settle itself, through the one
                // support door every other screen uses. Revoked details have no
                // self-service fix — claiming again returns the same dead
                // account, because the provider's create call is idempotent per
                // customer and currency. More accounts than we open by default is
                // a billing decision a person makes. The corridor rides along so
                // support does not have to ask which.
                onContactSupport={(corridor, reason) =>
                    openSupportWithMessage(`${SUPPORT_SUBJECT[reason]}: ${corridor}`)
                }
                // The other way into a corridor, when the standing account
                // cannot take the money: a transfer the user sends themselves.
                // It is a page of its own, so it carries where it came from —
                // leaving verification must not strand the user on a bare
                // amount route they never knowingly opened.
                onTopUp={(corridor) => {
                    const href = corridorTopUpHref(corridor, residenceIso2s)
                    if (href) router.push(withReturnTo(rewriteMethodPath(href), '/add-money?method=bank'))
                }}
                review={review}
            />
            {modals}
        </>
    )
}
