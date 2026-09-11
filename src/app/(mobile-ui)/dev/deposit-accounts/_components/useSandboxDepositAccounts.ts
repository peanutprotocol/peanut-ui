'use client'

import fixture from '@/features/deposit-accounts/__fixtures__/bridge-sandbox-virtual-accounts.json'
import { fromBridgeVirtualAccounts, type BridgeVirtualAccount } from '@/features/deposit-accounts/adapters/bridge'
import { fromMantecaArgentina, mantecaBrazilAccount } from '@/features/deposit-accounts/adapters/manteca'
import type { DepositAccount, DepositCorridor } from '@/features/deposit-accounts/types'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/** the sandbox customer's own name — what Bridge returns as the holder */
export const SANDBOX_USER_NAME = 'Sandbox User'

/** how long a claim spends provisioning before the details appear */
const PROVISIONING_MS = 1400

export type SandboxScenario = 'live' | 'all-claimed' | 'provisioning' | 'failed' | 'returned' | 'kyc'

/**
 * The prototype's data source: real Bridge sandbox payloads, captured by
 * mono `projects/virtual-accounts/capture-sandbox-vas.sh`, run through the
 * same adapters a product build would use. Nothing here is a hand-written
 * bank detail — the only invented values are the Manteca Argentine ones,
 * which come from the shipped constants.
 *
 * A product build replaces this hook with `GET /users/deposit-accounts` and
 * `POST /users/deposit-accounts`; every screen below it stays as it is.
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
        const argentina = fromMantecaArgentina({
            depositAddress: '0000003100010000000001',
            depositAlias: 'peanut.sandbox.ars',
        })
        const byCorridor: Record<DepositCorridor, DepositAccount | undefined> = {
            USD_ACH: undefined,
            EUR_SEPA: undefined,
            GBP_FPS: undefined,
            MXN_SPEI: undefined,
            BRL_PIX: mantecaBrazilAccount(),
            ARS_TRANSFER: argentina,
        }

        bridgeAccounts.forEach((account) => {
            byCorridor[account.corridor] = withScenarioStatus(account, scenario, claimed, claiming)
        })

        return byCorridor
    }, [bridgeAccounts, scenario, claimed, claiming])

    return {
        accounts,
        userName: SANDBOX_USER_NAME,
        kycGate: scenario === 'kyc',
        claimingCorridor: claiming,
        returnedPayment:
            scenario === 'returned'
                ? {
                      amount: '€500.00',
                      payer: 'ACME GmbH',
                      date: '28 Aug',
                      reason: 'the sending bank could not match the account holder.',
                  }
                : undefined,
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
    scenario: SandboxScenario,
    claimed: DepositCorridor[],
    claiming: DepositCorridor | undefined
): DepositAccount {
    if (scenario === 'provisioning') return { ...account, status: 'provisioning' }
    if (scenario === 'failed') return { ...account, status: 'failed' }
    if (scenario === 'all-claimed' || scenario === 'returned') return account

    if (claiming === account.corridor) return { ...account, status: 'provisioning' }
    if (claimed.includes(account.corridor)) return account
    return { ...account, status: 'unclaimed' }
}
