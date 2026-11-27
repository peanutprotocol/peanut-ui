'use client'

import { useAuth } from '@/context/authContext'
import { applyDepositPreviewGate } from '@/features/deposit-accounts/depositGate'
import {
    hasCompleteDepositInstructions,
    DEPOSIT_RAIL_ORDER,
    DEPOSIT_RAILS,
    corridorRecord,
    railIdFor,
    corridorFromRailId,
} from '@/features/deposit-accounts/rails'
import { DEPOSIT_ACCOUNTS_QUERY_KEY } from '@/features/deposit-accounts/useDepositAccounts'
import { useDepositAccountsEnabled } from '@/features/deposit-accounts/useDepositAccountsEnabled'
import { findPixRoute, pixDepositOffered, pixResidencePaused, pixRouteOpen } from '@/features/pix/pixRoute.utils'
import { useResidenceIso2s } from '@/features/deposit-accounts/useResidenceIso2s'
import { residenceAllows } from '@/features/deposit-accounts/residenceGate'
import type { UnavailableCause } from '@/features/deposit-accounts/types'
import { useCapabilities } from '@/hooks/useCapabilities'
import { fetchDepositAccounts } from '@/services/deposit-accounts'
import type { GateState } from '@/utils/capability-gate'
import { useQuery } from '@tanstack/react-query'
import { arsRowShown, resolveAddMoneyMethods } from './addMoneyMethods'

/**
 * Each corridor's deposit gate, narrowed by the feature report (`accountGates`), and the top-up's, which a
 * one-shot identity also needs set up (`topUpGates`). `causeFor` is the deposit-accounts read's reason a
 * corridor is withheld, where the caller reads it.
 */
function useDepositGates(causeFor: (railId: string) => UnavailableCause | undefined) {
    const { user } = useAuth()
    const { gateFor, capabilities } = useCapabilities()
    const accountGates = corridorRecord<GateState>((corridor) => {
        const rail = DEPOSIT_RAILS[corridor]
        const railId = railIdFor(corridor)
        const gate = applyDepositPreviewGate(gateFor('deposit', { railId }), causeFor(railId))
        if (gate.kind !== 'ready') return gate
        const report = capabilities.features?.[rail.provider === 'manteca' ? 'local' : 'bank']?.accounts[rail.currency]
        if (!report || report.state === 'on') return gate
        if (report.state === 'pending' || report.state === 'setting_up') return { kind: 'pending' }
        if (report.state === 'refused') return { kind: 'blocked-rejection', userMessage: null }
        return { kind: 'needs-enrollment' }
    })
    const topUpGates = corridorRecord<GateState>((corridor) => {
        const gate = accountGates[corridor]
        if (gate.kind !== 'ready' || user?.identityVerification?.oneShot !== true) return gate
        const rail = DEPOSIT_RAILS[corridor]
        const report = capabilities.features?.[rail.provider === 'manteca' ? 'local' : 'bank']?.accounts[rail.currency]
        return report?.state === 'on' ? gate : { kind: 'needs-enrollment' }
    })
    return { accountGates, topUpGates }
}

// a refusal, or an identity check to start over, is support's or the identity flow's to answer
const arsTopUpOpen = (gate: GateState) =>
    gate.kind !== 'loading' && gate.kind !== 'blocked-rejection' && gate.kind !== 'restart-identity'

/**
 * Do the Add lists lead with the ARS row (`arsRowShown`)? For the bank hub, which then leaves the peso
 * top-up out of its own list (the owner, 25 Nov). The peso top-up is no account, so the deposit-accounts
 * read names no cause for it, and this needs no read of its own.
 */
export function useArsLeadsAddMoney(): boolean {
    const residenceIso2s = useResidenceIso2s()
    const gate = useDepositGates(() => undefined).topUpGates.BANK_TRANSFER_AR
    return arsRowShown({
        arsTopUpOpen: arsTopUpOpen(gate),
        residenceIso2s,
        arsReady: gate.kind === 'ready' && residenceAllows('BANK_TRANSFER_AR', [...residenceIso2s]),
    })
}

/** One owner-scoped read shared by the Home button and drawer, without polling. */
export function useAddMoneyReadiness(cryptoReady: boolean, readAccounts = true) {
    const { user, userId } = useAuth()
    const { capabilities, isLoading: capabilitiesLoading } = useCapabilities()
    const standingEnabled = useDepositAccountsEnabled()
    const residenceIso2s = useResidenceIso2s()
    const query = useQuery({
        queryKey: [...DEPOSIT_ACCOUNTS_QUERY_KEY, userId],
        queryFn: fetchDepositAccounts,
        enabled: !!userId && readAccounts && standingEnabled,
        staleTime: 5 * 60 * 1000,
    })
    const { accountGates, topUpGates } = useDepositGates(
        (railId) =>
            (standingEnabled && readAccounts ? query.data : undefined)?.unavailable?.find(
                (entry) => entry.railId === railId
            )?.cause
    )
    const accounts = readAccounts && standingEnabled && !query.isError ? (query.data?.accounts ?? []) : []
    const activeAccounts = accounts.flatMap((account) => {
        const corridor = corridorFromRailId(account.railId)
        return corridor &&
            accountGates[corridor].kind === 'ready' &&
            account.status === 'active' &&
            hasCompleteDepositInstructions(corridor, account.instructions)
            ? [DEPOSIT_RAILS[corridor].currency]
            : []
    })
    const readyTopUps = DEPOSIT_RAIL_ORDER.flatMap((corridor) => {
        return topUpGates[corridor].kind === 'ready' ? [DEPOSIT_RAILS[corridor].currency] : []
    })
    const pixDepositRoute = findPixRoute(capabilities.routes, 'deposit')
    // the Brazil pause by its reason: an outage of the provider keeps Pix, and the Pix page shows it
    const brazilPaused = pixResidencePaused(pixDepositRoute)
    const resolved = resolveAddMoneyMethods({
        cryptoReady,
        standingEnabled,
        brazilPaused,
        residenceIso2s,
        activeAccounts,
        readyTopUps,
        firstPaymentAt: user?.user?.firstPaymentAt,
        pixDepositOffered: pixDepositOffered(pixDepositRoute),
        pixDepositRouteOpen: pixRouteOpen(pixDepositRoute) && pixDepositRoute?.state !== 'paused',
        arsTopUpOpen: arsTopUpOpen(topUpGates.BANK_TRANSFER_AR),
    })
    const isLoading = !userId || capabilitiesLoading || (readAccounts && standingEnabled && query.isLoading)
    return {
        ...resolved,
        isLoading,
        residenceIso2s,
        brazilPaused,
        standingEnabled,
        topUpGates,
        entry: isLoading || (readAccounts && standingEnabled && query.isError) ? ('picker' as const) : resolved.entry,
    }
}
