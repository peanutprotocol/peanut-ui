'use client'

import { useAuth } from '@/context/authContext'
import { useBrazilServicesPaused } from '@/features/brazil-pause/useBrazilServicesPaused'
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
import { findPixRoute, pixRouteOpen } from '@/features/pix/pixRoute.utils'
import { useResidenceIso2s } from '@/features/deposit-accounts/useResidenceIso2s'
import { useCapabilities } from '@/hooks/useCapabilities'
import { fetchDepositAccounts } from '@/services/deposit-accounts'
import type { GateState } from '@/utils/capability-gate'
import { useQuery } from '@tanstack/react-query'
import { resolveAddMoneyMethods } from './addMoneyMethods'

/** One owner-scoped read shared by the Home button and drawer, without polling. */
export function useAddMoneyReadiness(cryptoReady: boolean, readAccounts = true) {
    const { user, userId } = useAuth()
    const { gateFor, capabilities, isLoading: capabilitiesLoading } = useCapabilities()
    const standingEnabled = useDepositAccountsEnabled()
    const brazilPaused = useBrazilServicesPaused()
    const residenceIso2s = useResidenceIso2s()
    const query = useQuery({
        queryKey: [...DEPOSIT_ACCOUNTS_QUERY_KEY, userId],
        queryFn: fetchDepositAccounts,
        enabled: !!userId && readAccounts && standingEnabled,
        staleTime: 5 * 60 * 1000,
    })
    const accountGates = corridorRecord<GateState>((corridor) => {
        const rail = DEPOSIT_RAILS[corridor]
        const railId = railIdFor(corridor)
        const cause = (standingEnabled && readAccounts ? query.data : undefined)?.unavailable?.find(
            (entry) => entry.railId === railId
        )?.cause
        const gate = applyDepositPreviewGate(gateFor('deposit', { railId }), cause)
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
    const resolved = resolveAddMoneyMethods({
        cryptoReady,
        standingEnabled,
        brazilPaused,
        residenceIso2s,
        activeAccounts,
        readyTopUps,
        firstPaymentAt: user?.user?.firstPaymentAt,
        pixRouteOpen: pixRouteOpen(findPixRoute(capabilities.routes, 'deposit')),
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
