import { corridorTopUpHref } from '@/features/add-money/countryRoutes'
import { ARS_ADD_MONEY_PATH, DEPOSIT_RAIL_ORDER, DEPOSIT_RAILS } from '@/features/deposit-accounts/rails'
import { residenceAllows } from '@/features/deposit-accounts/residenceGate'
import type { DepositCorridor } from '@/features/deposit-accounts/types'
import { PIX_ADD_MONEY_PATH } from '@/features/pix/pix.routes'
import type { IdentityVerificationStatus } from '@/types/capabilities'
import type { GateState } from '@/utils/capability-gate'
import { rewriteMethodPath } from '@/utils/native-routes'
import { withReturnTo } from '@/utils/return-to.utils'

/**
 * The add-money drawer's decisions (TASK-25169, shared in TASK-25467), kept pure so every state the
 * drawer shows is tested here. Spec: the "Add money in place" proposal (TASK-24869), with each
 * "Suggested" answer as the default.
 */

/** What is missing to the target, rounded UP to the cent: a gap rounded down leaves the user short. */
export function addMoneyGapUsd(targetUsd: number, spendableUsd: number | undefined): number | undefined {
    if (spendableUsd === undefined) return undefined
    const cents = Math.ceil(Math.round((targetUsd - spendableUsd) * 1e6) / 1e4)
    return Math.max(cents, 0) / 100
}

/**
 * The amount a crypto deposit asks for. Rhino never bridges a deposit below the network's runtime
 * minimum, and the money would strand uncredited, so a smaller gap asks for the minimum; the extra
 * stays in the balance.
 */
export function cryptoAskUsd(gapUsd: number, minDepositUsd: number): { askUsd: number; raisedToMinimum: boolean } {
    // up to the cent: a minimum of $4.004 shown as "$4" invites a deposit that strands
    const minimum = Math.ceil(Math.round(minDepositUsd * 1e6) / 1e4) / 100
    return gapUsd < minimum ? { askUsd: minimum, raisedToMinimum: true } : { askUsd: gapUsd, raisedToMinimum: false }
}

/** A bank option ready now: a held account shows its details in the drawer; the rest open their page. */
export type DrawerBankRow = { kind: 'account' | 'page'; corridor: DepositCorridor }

export type DrawerBankPlan =
    | { kind: 'loading' }
    | { kind: 'rows'; rows: DrawerBankRow[] }
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
 * order Add money's picker uses: ARS, Pix when the route offers it on Avenia, held accounts, one-time
 * transfers, then any other ready Pix; each group in the rail order. With nothing
 * ready, one status answers, the most hopeful first: a rail being set up, then a review, then the
 * user's own verification, then a step left on the bank page. A rail the residence rules out says
 * nothing about this user.
 */
export function drawerBankPlan(input: {
    isLoading: boolean
    residenceIso2s: readonly string[]
    ready: { account: readonly string[]; transfer: readonly string[]; pix: readonly string[]; ars: readonly string[] }
    topUpGates: Record<DepositCorridor, GateState>
    /** `identityVerification.status`: a check in review reads `needs-identity` on the rails until it ends */
    identityStatus?: IdentityVerificationStatus
    /** `resolveAddMoneyMethods`' picker order: Pix before `transfer` means Pix leads */
    pickerMethods?: readonly string[]
}): DrawerBankPlan {
    if (input.isLoading) return { kind: 'loading' }
    const rows: DrawerBankRow[] = []
    const picker = input.pickerMethods ?? []
    const pixLeads = picker.includes('pix') && picker.indexOf('pix') < picker.indexOf('transfer')
    const pix: DrawerBankRow[] = input.ready.pix.length ? [{ kind: 'page', corridor: 'PIX_BR' }] : []
    const inRailOrder = (currencies: readonly string[]) =>
        DEPOSIT_RAIL_ORDER.filter((c) => currencies.includes(DEPOSIT_RAILS[c].currency))
    const held = inRailOrder(input.ready.account)
    if (input.ready.ars.length) rows.push({ kind: 'page', corridor: 'BANK_TRANSFER_AR' })
    if (pixLeads) rows.push(...pix)
    rows.push(...held.map((corridor) => ({ kind: 'account' as const, corridor })))
    for (const corridor of inRailOrder(input.ready.transfer)) {
        // a held account already takes this currency's transfers
        if (!held.includes(corridor)) rows.push({ kind: 'page', corridor })
    }
    if (!pixLeads) rows.push(...pix)
    if (rows.length) return { kind: 'rows', rows }

    const relevant = DEPOSIT_RAIL_ORDER.filter((c) => residenceAllows(c, [...input.residenceIso2s]))
    const kinds = relevant.map((c) => input.topUpGates[c].kind)
    if (kinds.includes('loading')) return { kind: 'loading' }
    const settingUp = relevant.find((c) => input.topUpGates[c].kind === 'pending')
    if (settingUp) return { kind: 'setting-up', corridor: settingUp }
    // the user's own ID in review comes first: no bank account can open before it ends
    if (input.identityStatus === 'processing') return { kind: 'under-review' }
    if (kinds.includes('waiting-on-provider')) return { kind: 'under-review' }
    if (kinds.includes('needs-identity')) return { kind: 'not-verified' }
    if (kinds.some((kind) => FINISH_SETUP_KINDS.has(kind))) return { kind: 'finish-setup' }
    return { kind: 'not-offered' }
}

/**
 * The page a bank row opens, with the gap prefilled where the page reads a dollar amount: the ARS
 * flow takes `currency=USD`; a Bridge top-up takes its amount in the rail's own currency, so only a
 * dollar rail gets it; the Pix page reads no amount. `returnTo` brings the user back to the place that
 * opened the drawer. The place's cached gap is enough here, unlike the drawer's own ask
 * (DrawerBankDetailsView reads fresh): this only prefills an amount field the user edits
 * on the page, always in dollars (the page converts and quotes the rest), and a fresh read would hold
 * the tap on a network round trip.
 */
export function bankPageHref(
    corridor: DepositCorridor,
    gapUsd: number | undefined,
    residenceIso2s: readonly string[],
    returnTo: string
): string {
    const amount = gapUsd ? gapUsd.toFixed(2) : undefined
    if (corridor === 'BANK_TRANSFER_AR') {
        const prefill = amount ? `step=inputAmount&amount=${amount}&currency=USD` : undefined
        return withReturnTo(rewriteMethodPath(ARS_ADD_MONEY_PATH, prefill), returnTo)
    }
    if (corridor === 'PIX_BR') return withReturnTo(PIX_ADD_MONEY_PATH, returnTo)
    const href = corridorTopUpHref(corridor, residenceIso2s)
    if (!href) return withReturnTo('/add-money?method=bank', returnTo)
    const prefill = amount && DEPOSIT_RAILS[corridor].currency === 'USD' ? `amount=${amount}` : undefined
    return withReturnTo(rewriteMethodPath(href, prefill), returnTo)
}
