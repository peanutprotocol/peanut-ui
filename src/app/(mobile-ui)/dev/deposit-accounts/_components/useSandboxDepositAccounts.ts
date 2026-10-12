'use client'

import fixture from './bridge-sandbox-virtual-accounts.json'
import { fromBridgeVirtualAccounts, type BridgeVirtualAccount } from './bridgeFixtureAdapter'
import { corridorFromRailId, DEPOSIT_RAIL_ORDER, emptyCorridorRecord } from '@/features/deposit-accounts/rails'
import type { DepositAccount, DepositAccountView, DepositCorridor } from '@/features/deposit-accounts/types'
import type { GateState } from '@/utils/capability-gate'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/** the sandbox customer's own name — what Bridge returns as the holder */
export const SANDBOX_USER_NAME = 'Sandbox User'

/** how long a claim spends provisioning before the details appear */
const PROVISIONING_MS = 1400

export type SandboxScenario = 'live' | 'all-claimed' | 'provisioning' | 'timed-out' | 'kyc'

/**
 * The prototype's data source: real Bridge sandbox payloads, captured by
 * mono `projects/virtual-accounts/capture-sandbox-vas.sh`, run through the
 * same adapters a product build would use. Nothing here is a hand-written
 * bank detail.
 *
 * A product build replaces this hook with `GET /users/deposit-accounts` and
 * `POST /users/deposit-accounts`, and takes its corridors from the user's own
 * rails; the prototype offers all of them, so every screen can be reviewed.
 */
export function useSandboxDepositAccounts(scenario: SandboxScenario) {
    const bridgeAccounts = useMemo(
        () => fromBridgeVirtualAccounts(fixture.data as BridgeVirtualAccount[], SANDBOX_USER_NAME),
        []
    )

    const [claimed, setClaimed] = useState<DepositCorridor[]>([])
    const [claiming, setClaiming] = useState<DepositCorridor | undefined>()
    const timers = useRef<ReturnType<typeof setTimeout>[]>([])

    const claim = useCallback((corridor: DepositCorridor) => {
        setClaiming(corridor)
        timers.current.push(
            setTimeout(() => {
                setClaimed((current) => (current.includes(corridor) ? current : [...current, corridor]))
                setClaiming(undefined)
            }, PROVISIONING_MS)
        )
    }, [])

    useEffect(() => () => timers.current.forEach(clearTimeout), [])

    const reset = useCallback(() => {
        timers.current.forEach(clearTimeout)
        timers.current = []
        setClaimed([])
        setClaiming(undefined)
    }, [])

    const accounts = useMemo(() => {
        const byCorridor = emptyCorridorRecord<DepositAccountView>()

        bridgeAccounts.forEach((account) => {
            const corridor = corridorFromRailId(account.railId)
            if (corridor) byCorridor[corridor] = withScenarioStatus(account, corridor, scenario, claimed, claiming)
        })

        return byCorridor
    }, [bridgeAccounts, scenario, claimed, claiming])

    return {
        corridors: DEPOSIT_RAIL_ORDER,
        accounts,
        userName: SANDBOX_USER_NAME,
        // a product build asks gateFor('deposit', { railId }) once per corridor;
        // the harness fakes the one kind this prototype needs to show, the same
        // on every corridor
        gates: Object.fromEntries(
            DEPOSIT_RAIL_ORDER.map((corridor) => [
                corridor,
                (scenario === 'kyc' ? { kind: 'needs-identity' } : { kind: 'ready' }) satisfies GateState,
            ])
        ) as Record<DepositCorridor, GateState>,
        claimingCorridor: claiming,
        claim,
        reset,
    }
}

/**
 * Which status a corridor shows. `live` is the honest one — nothing is held
 * until the user claims it — and the rest force a single state so every
 * screen can be reviewed without waiting for the real transition.
 */
function withScenarioStatus(
    account: DepositAccount,
    corridor: DepositCorridor,
    scenario: SandboxScenario,
    claimed: DepositCorridor[],
    claiming: DepositCorridor | undefined
): DepositAccountView {
    if (scenario === 'provisioning') return { ...account, status: 'provisioning' }
    // the wait the app gives the provider, spent — a client-side state, so the
    // status stays what the provider last said
    if (scenario === 'timed-out') return { ...account, status: 'provisioning', timedOut: true }
    if (scenario === 'all-claimed') return account

    if (claiming === corridor) return { ...account, status: 'provisioning' }
    if (claimed.includes(corridor)) return account
    return { ...account, status: 'unclaimed' }
}
