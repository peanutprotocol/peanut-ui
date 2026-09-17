/**
 * A deposit account is bank details a Peanut user hands to somebody else so
 * that person can pay them. One shape covers every provider and every region:
 * the screens read the policy fields below and never branch on the provider.
 *
 * The policy fields are the whole design. Whether the payer sees the user's
 * name and whether a stranger may pay at all differ per corridor today, and
 * each changes what the UI is allowed to say.
 *
 * The wire types are DERIVED from the generated contract rather than restated
 * here. A hand-written copy typechecks against a response it no longer
 * matches, so `pnpm gen:api` stayed green while the screens read fields the
 * API had dropped. Now a dropped field fails the build at every reader.
 */

import type { paths } from '@/types/api.generated'

type DepositAccountsResponse = paths['/users/deposit-accounts']['get']['responses'][200]['content']['application/json']

/**
 * One account, exactly as `GET /users/deposit-accounts` returns it. The FE
 * adds nothing: `railId` carries the corridor, `matching` carries what the
 * screens are allowed to say, and the provider is deliberately absent.
 */
export type DepositAccount = DepositAccountsResponse['depositAccounts'][number]

type DepositProvider = 'bridge' | 'manteca'

export type DepositCorridor =
    | 'ACH_US'
    | 'SEPA_EU'
    | 'FASTER_PAYMENTS_GB'
    | 'SPEI_MX'
    | 'BANK_TRANSFER_BR'
    | 'BANK_TRANSFER_CO'
    | 'PIX_BR'
    | 'BANK_TRANSFER_AR'

/**
 * `provisioning` — claimed, the provider has not returned details yet.
 * `active` — details are ready to share.
 * `retiring` — replaced by a newer account, still accepting money.
 * `revoked` — the account existed and no longer accepts money. It gets its own
 *   state because the details are in somebody else's payroll file, and Bridge
 *   returns anything sent to a deactivated account, so the user has to be told
 *   to stop handing them out rather than to try again.
 *
 * `unclaimed` and `unavailable` are NOT wire states. The backend returns no
 * row for a corridor nobody has claimed and no row for one it cannot serve, so
 * the client names those two itself — which is why they live on
 * `DepositAccountView` and never on the account the service returns.
 */
export type ClientDepositStatus = 'unclaimed' | 'unavailable'

export type DepositAccountStatus = DepositAccount['status'] | ClientDepositStatus

export type DepositMatching = DepositAccount['matching']

/**
 * A corridor the user may open, with the terms it WOULD carry. The backend
 * runs the SAME resolver a held account reads, before an account exists, so
 * the claim step and the account screen can never say different things about
 * who may pay in.
 *
 * `preview: true` means one input was unavailable when the terms were
 * resolved — today only the residence subdivision, which only USD reads. The
 * terms are the rail's published ones and the state rule is not in them, so
 * the screen says the terms are confirmed on opening rather than dropping
 * them.
 *
 * `matching` carries no `nameOnAccount`: that field compares the holder name
 * the provider returns against the user's, and no account has returned one
 * yet.
 */
export type ClaimableCorridor = DepositAccountsResponse['claimable'][number]

/**
 * What the rule resolver needs to state a corridor's terms: the sender policy
 * always, and the holder name only where an account exists to have one. One
 * parameter type for both callers, so the claim step and the details screen
 * run the same resolver rather than each getting its own.
 */
export type DepositSenderTerms = Pick<DepositMatching, 'sender'> & Partial<Pick<DepositMatching, 'nameOnAccount'>>

/**
 * Who may pay into it.
 *
 * `unknown` is a real answer and the most common one. Bridge documents a
 * third-party policy for some currencies and says nothing for others, and
 * `product/providers/fiat/rails/virtual-accounts.md` is explicit that the
 * silence is not permission. A corridor we cannot vouch for does not get the
 * "anyone can pay you" promise, because that promise is the whole product and
 * a wrong one sends somebody's salary back.
 */
export type SenderPolicy = DepositMatching['sender']

/**
 * The documented terms behind a corridor's sender policy, as the backend
 * returns them. The three payers are answered separately, because every rail
 * lets the holder pay themselves in and the restrictions are about other
 * people: one enum for all three said "business only" on EUR and GBP, which
 * reads as "your own top-up is returned". A corridor with nothing published
 * carries no `rules` at all rather than a row of defaults the screens would
 * read as promises.
 *
 * Source of truth is peanut-api-ts `src/deposit-accounts/bridge-adapter.ts`,
 * which derives these from
 * `product/providers/fiat/bridge-contracts-and-rail-rules.md` §3. The app
 * renders them and authors none of them.
 */
export type DepositRules = NonNullable<DepositAccount['rules']>

/** an amount with its currency, as every limit in `DepositRules` carries it */
export type DepositAmount = NonNullable<DepositRules['min']>

/**
 * Provider instructions, normalised. Every field is optional except the
 * holder name, because corridors genuinely differ: Mexican SPEI returns a
 * CLABE and no bank name at all, and UK Faster Payments returns no beneficiary
 * name. Presence is the only reliable signal — never assume a field by
 * currency.
 */
export type DepositInstructions = NonNullable<DepositAccount['instructions']>

/**
 * What the screens actually render: the account the backend returned, plus the
 * two facts only the client knows.
 *
 * `timedOut` is set when the provisioning poll spent its budget and the
 * provider never answered. It is not a status: the backend has not said the
 * account failed, and nothing in this flag ever travels back over the wire —
 * which is why it sits beside `DepositAccount` rather than inside it. The
 * widened `status` is there for the same reason.
 */
export interface DepositAccountView extends Omit<DepositAccount, 'status'> {
    status: DepositAccountStatus
    timedOut?: true
}

/** presentation facts the provider payload does not carry */
export interface DepositRail {
    corridor: DepositCorridor
    currency: string
    provider: DepositProvider
    flagIso2: string
    /** how many rows the details card shows, so the provisioning skeleton matches it */
    detailRowCount: number
    /** false where the corridor cannot be held as a reusable account */
    claimable?: false
    /** where a corridor that cannot be claimed does its real top-up instead */
    topUpHref?: string
}

/** every row a corridor can show; the label for each lives in the catalog */
export type DepositRowKey =
    | 'accountHolder'
    | 'bank'
    | 'iban'
    | 'bic'
    | 'sortCode'
    | 'accountNumber'
    | 'routingNumber'
    | 'clabe'
    | 'brCode'
    | 'breBKey'
    | 'bankAddress'
    | 'beneficiaryAddress'
    | 'accepts'

export type DepositRowLabels = Record<DepositRowKey, string>

export interface DepositDetailRow {
    key: DepositRowKey
    label: string
    value: string
    /** informational rows opt out of the copy button */
    copyable?: boolean
}
