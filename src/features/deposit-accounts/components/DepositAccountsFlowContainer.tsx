'use client'

import { useAuth } from '@/context/authContext'
import { useModalsContext } from '@/context/ModalsContext'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useRouter } from 'next/navigation'
import { DepositAccountsFlow, type DepositSupportReason } from './DepositAccountsFlow'
import { useDepositAccounts } from '../useDepositAccounts'
import { useDepositAccountsEnabled } from '../useDepositAccountsEnabled'
import { useDepositGateRemediation } from '../useDepositGateRemediation'

const HOSTED_CHECK_ROUTE = '/profile/accounts-and-payments/additional'

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
    // While standing accounts are dark, the hub is the country list alone —
    // asking the backend for accounts nobody can open yet buys nothing.
    const accountsEnabled = useDepositAccountsEnabled()
    const {
        corridors,
        accounts,
        claimable,
        slotsHeld,
        gates,
        isLoading,
        isError,
        claimingCorridor,
        claimError,
        claim,
        refetch,
    } = useDepositAccounts({ enabled: accountsEnabled })
    const { user } = useAuth()
    const { resolveGate, modals } = useDepositGateRemediation()
    const { openSupportWithMessage } = useModalsContext()
    const router = useRouter()
    // A provider review that waits on the user is cleared in the provider's
    // hosted check, and the backend only hands out that link to a user whose
    // capabilities carry the action. A future-dated one is advisory and blocks
    // nothing, so it is not the action this review needs.
    const { nextActions } = useCapabilities()
    const canFinishReview = nextActions.some((action) => action.kind === 'bridge-hosted' && !action.effectiveDate)

    return (
        <>
            <DepositAccountsFlow
                corridors={corridors}
                accounts={accounts}
                claimable={claimable}
                slotsHeld={slotsHeld}
                gates={gates}
                isLoading={isLoading}
                isError={isError}
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
                // The prep screen in front of the hosted check: it says what to
                // have ready and starts the check from its own button.
                // Back from it returns here through history.
                onFinishReview={canFinishReview ? () => router.push(HOSTED_CHECK_ROUTE) : undefined}
            />
            {modals}
        </>
    )
}
