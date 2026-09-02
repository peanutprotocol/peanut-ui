import type { FlowStepGuard } from '@/hooks/useFlowStepper.types'
import type { WithdrawBankStep, WithdrawCryptoStep, WithdrawMantecaStep } from './types'

/**
 * Entry guards for the withdraw flows' URL steps. The step param is
 * user-editable, so every terminal screen is gated on flow-local EXECUTION
 * proof — state that is only set after the money operation succeeded — never
 * on pre-execution data alone. A hand-edited `?step=success` (or a refresh
 * that lost flow memory) falls back to the working step instead of rendering
 * a success screen for a withdrawal that never ran (Chip review, PR #2917).
 */

export function bankStepGuards({
    executed,
}: {
    /** confirmOfframp succeeded — the money leg is real. */
    executed: boolean
}): Partial<Record<WithdrawBankStep, FlowStepGuard<WithdrawBankStep>>> {
    return {
        success: { ok: executed, fallback: 'review' },
    }
}

export function cryptoStepGuards({
    prepared,
    executed,
}: {
    /** charge + route data exist (pre-execution). */
    prepared: boolean
    /** the transfer broadcast and returned a transaction identifier. */
    executed: boolean
}): Partial<Record<WithdrawCryptoStep, FlowStepGuard<WithdrawCryptoStep>>> {
    return {
        review: { ok: prepared },
        success: { ok: prepared && executed },
    }
}

export type MantecaOutcome = 'success' | 'failure' | null

export function mantecaStepGuards({
    hasAmount,
    priceLocked,
    outcome,
}: {
    hasAmount: boolean
    priceLocked: boolean
    /** set only by the withdrawal submission — success or terminal failure. */
    outcome: MantecaOutcome
}): Partial<Record<WithdrawMantecaStep, FlowStepGuard<WithdrawMantecaStep>>> {
    return {
        'bank-details': { ok: hasAmount },
        review: { ok: hasAmount && priceLocked },
        success: { ok: outcome === 'success' },
        failure: { ok: outcome === 'failure' },
    }
}
