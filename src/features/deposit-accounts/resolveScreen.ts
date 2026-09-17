import { depositGateView } from './depositGate'
import { isClaimable, isShareable } from './rails'
import type { DepositAccountScreen } from './params'
import type { DepositAccountView, DepositRail } from './types'
import type { GateState } from '@/utils/capability-gate'

/**
 * Which screen may actually render, given the gate and the account.
 *
 * The URL is the source of truth for where the user is, which means the URL is
 * also an input a user can hand-edit or a stale link can carry. Every screen
 * therefore states its own preconditions here rather than trusting the param:
 * `?step=claim` would offer
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
/**
 * Does the user already hold this account? A held account has details to read
 * whatever the gate says later — the gate governs opening a new one. A revoked
 * account is still held: the details are in a payer's records and the screen
 * has to explain why money sent to them will not arrive, and the provider has
 * no replacement to give on the same corridor.
 */
export function isHeld(account: DepositAccountView | undefined): boolean {
    return account !== undefined && account.status !== 'unclaimed'
}

/** Sharing needs active instructions, a permitted sender policy and an open corridor. */
export function canShare(account: DepositAccountView | undefined, gate: GateState): boolean {
    if (!account?.instructions || account.status !== 'active') return false
    if (!isShareable(account.matching.sender)) return false
    // Handing details to a payer is an action on a corridor, so it needs that
    // corridor's gate. Reading details the user already holds is not: a
    // corridor that goes blocked after the fact still has money to explain,
    // and hiding it would strand the user mid-conversation with whoever is
    // paying them.
    return depositGateView(gate).claimable
}

export function resolveScreen(
    requested: DepositAccountScreen,
    rail: DepositRail,
    account: DepositAccountView | undefined,
    gate: GateState
): DepositAccountScreen {
    const { claimable } = depositGateView(gate)
    const held = isHeld(account)

    if (requested === 'claim') {
        // nothing to claim: the corridor does not offer an account, the gate
        // has not cleared, or the user already has one. A REVOKED account is
        // still one: the provider's create call is idempotent per customer and
        // currency, so asking again returns the dead account rather than a
        // replacement. Replacing it needs backend work that does not exist.
        if (!isClaimable(rail) || !claimable || held) return held ? 'details' : 'list'
        return 'claim'
    }

    if (requested === 'details') {
        // A corridor nobody can hold has no account and still has a details
        // screen: why it is not a standing account, and the top-up route that
        // is its real way in.
        if (!isClaimable(rail)) return 'details'
        if (!account) return claimable ? 'claim' : 'list'
        if (account.status === 'unclaimed') return claimable ? 'claim' : 'list'
        return 'details'
    }

    return 'list'
}
