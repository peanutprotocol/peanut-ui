import { depositGateView } from './depositGate'
import { isClaimable, isShareable } from './rails'
import type { DepositAccountScreen } from './params'
import type { DepositAccount, DepositRail } from './types'
import type { GateState } from '@/utils/capability-gate'

/**
 * Which screen may actually render, given the gate and the account.
 *
 * The URL is the source of truth for where the user is, which means the URL is
 * also an input a user can hand-edit or a stale link can carry. Every screen
 * therefore states its own preconditions here rather than trusting the param:
 * `?screen=share` on an own-name-only corridor would otherwise offer a Share
 * button for details nobody else may pay into, and `?screen=claim` would offer
 * to open an account the user already holds, or one the gate has not cleared.
 *
 * The gate passed here is the SELECTED corridor's gate, never the bank-wide
 * one: a bank-wide gate is `ready` as soon as any bank rail is enabled, so a
 * user with one working corridor could hand-edit `?corridor=` to a blocked one
 * and pass the claim precondition.
 *
 * The fallback is always the most informative screen the user is entitled to,
 * never an error.
 */
export function resolveScreen(
    requested: DepositAccountScreen,
    rail: DepositRail,
    account: DepositAccount | undefined,
    gate: GateState
): DepositAccountScreen {
    const { claimable } = depositGateView(gate)
    const held = account !== undefined && account.status !== 'unclaimed'

    if (requested === 'claim') {
        // nothing to claim: the corridor does not offer an account, the gate
        // has not cleared, or the user already has one
        if (!isClaimable(rail) || !claimable || held) return held ? 'details' : 'list'
        return 'claim'
    }

    if (requested === 'share') {
        if (!account?.instructions || account.status !== 'active') return held ? 'details' : 'list'
        if (!isShareable(account.matching.sender)) return 'details'
        // Handing details to a payer is an action on a corridor, so it needs
        // that corridor's gate. Reading details the user already holds is not:
        // a corridor that goes blocked after the fact still has money to
        // explain, and hiding it would strand the user mid-conversation with
        // whoever is paying them.
        if (!claimable) return 'details'
        return 'share'
    }

    if (requested === 'details') {
        if (!account) return isClaimable(rail) && claimable ? 'claim' : 'list'
        if (account.status === 'unclaimed') return claimable ? 'claim' : 'list'
        return 'details'
    }

    return 'list'
}
