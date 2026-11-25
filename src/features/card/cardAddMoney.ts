import { DEPOSIT_RAIL_ORDER, DEPOSIT_RAILS } from '@/features/deposit-accounts/rails'
import { residenceAllows } from '@/features/deposit-accounts/residenceGate'
import type { DepositCorridor } from '@/features/deposit-accounts/types'
import type { GateState } from '@/utils/capability-gate'

/**
 * The card's add-money drawer decisions (TASK-25169), kept pure so every state the drawer shows is
 * tested here. Spec: the "Add money in place" proposal (TASK-24869), card flow, with each
 * "Suggested" answer as the default.
 */

/** The spendable balance the card needs before the application starts. */
export const CARD_MIN_BALANCE_USD = 10

/** What is missing to the card minimum, rounded UP to the cent: a gap rounded down leaves the user short. */
export function cardGapUsd(spendableUsd: number | undefined): number | undefined {
    if (spendableUsd === undefined) return undefined
    const cents = Math.ceil(Math.round((CARD_MIN_BALANCE_USD - spendableUsd) * 1e6) / 1e4)
    return Math.max(cents, 0) / 100
}

/**
 * The amount a crypto deposit asks for. Rhino never bridges a deposit below the network's runtime
 * minimum, and the money would strand uncredited, so a smaller gap asks for the minimum; the extra
 * stays in the balance.
 */
export function cardCryptoAskUsd(gapUsd: number, minDepositUsd: number): { askUsd: number; raisedToMinimum: boolean } {
    return gapUsd < minDepositUsd
        ? { askUsd: minDepositUsd, raisedToMinimum: true }
        : { askUsd: gapUsd, raisedToMinimum: false }
}

/** A bank option ready now: a held account shows its details in the drawer; the rest open their page. */
export type CardBankRow = { kind: 'account' | 'page'; corridor: DepositCorridor }

export type CardBankPlan =
    | { kind: 'loading' }
    | { kind: 'rows'; rows: CardBankRow[] }
    /** a rail is being opened for the user; the provider gives no time, so the drawer shows none */
    | { kind: 'setting-up'; corridor: DepositCorridor }
    | { kind: 'under-review' }
    | { kind: 'not-verified' }
    /** verified, with one step of their own left (terms, enrollment, a fix): the existing bank page takes it */
    | { kind: 'finish-setup' }
    | { kind: 'not-offered' }

const FINISH_SETUP_KINDS: ReadonlySet<GateState['kind']> = new Set([
    'needs-enrollment',
    'accept-tos',
    'fixable-rejection',
    'provide-email',
    'restart-identity',
])

/**
 * What the drawer's bank view shows, from `useAddMoneyReadiness`. Ready options come first, in the
 * order Add money uses (ARS and Pix lead for their residents, then the rail order). With nothing
 * ready, one status answers, the most hopeful first: a rail being set up, then a review, then the
 * user's own verification, then a step left on the bank page. A rail the residence rules out says
 * nothing about this user.
 */
export function cardBankPlan(input: {
    isLoading: boolean
    residenceIso2s: readonly string[]
    ready: { account: readonly string[]; transfer: readonly string[]; pix: readonly string[]; ars: readonly string[] }
    topUpGates: Record<DepositCorridor, GateState>
}): CardBankPlan {
    if (input.isLoading) return { kind: 'loading' }
    const rows: CardBankRow[] = []
    if (input.ready.ars.length) rows.push({ kind: 'page', corridor: 'BANK_TRANSFER_AR' })
    if (input.ready.pix.length) rows.push({ kind: 'page', corridor: 'PIX_BR' })
    for (const corridor of DEPOSIT_RAIL_ORDER) {
        const currency = DEPOSIT_RAILS[corridor].currency
        if (input.ready.account.includes(currency)) rows.push({ kind: 'account', corridor })
        else if (input.ready.transfer.includes(currency)) rows.push({ kind: 'page', corridor })
    }
    if (rows.length) return { kind: 'rows', rows }

    const relevant = DEPOSIT_RAIL_ORDER.filter((c) => residenceAllows(c, [...input.residenceIso2s]))
    const kinds = relevant.map((c) => input.topUpGates[c].kind)
    if (kinds.includes('loading')) return { kind: 'loading' }
    const settingUp = relevant.find((c) => input.topUpGates[c].kind === 'pending')
    if (settingUp) return { kind: 'setting-up', corridor: settingUp }
    if (kinds.includes('waiting-on-provider')) return { kind: 'under-review' }
    if (kinds.includes('needs-identity')) return { kind: 'not-verified' }
    if (kinds.some((kind) => FINISH_SETUP_KINDS.has(kind))) return { kind: 'finish-setup' }
    return { kind: 'not-offered' }
}
