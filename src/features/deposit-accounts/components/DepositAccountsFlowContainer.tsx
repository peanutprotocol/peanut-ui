'use client'

import { useAuth } from '@/context/authContext'
import { useModalsContext } from '@/context/ModalsContext'
import { DepositAccountsFlow } from './DepositAccountsFlow'
import { useDepositAccounts } from '../useDepositAccounts'
import { useDepositAccountsEnabled } from '../useDepositAccountsEnabled'
import { useDepositGateRemediation } from '../useDepositGateRemediation'

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
    const { corridors, accounts, claimable, gates, isLoading, isError, claimingCorridor, claimError, claim, refetch } =
        useDepositAccounts({ enabled: accountsEnabled })
    const { user } = useAuth()
    const { resolveGate, modals } = useDepositGateRemediation()
    const { openSupportWithMessage } = useModalsContext()

    return (
        <>
            <DepositAccountsFlow
                corridors={corridors}
                accounts={accounts}
                claimable={claimable}
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
                // Revoked details have no self-service fix: claiming again
                // returns the same dead account, because the provider's create
                // call is idempotent per customer and currency. The corridor
                // rides along so support does not have to ask which one.
                onContactSupport={(corridor) => openSupportWithMessage(`Revoked deposit details: ${corridor}`)}
            />
            {modals}
        </>
    )
}
