/**
 * A deposit account is bank details a Peanut user hands to somebody else so
 * that person can pay them. One shape covers every provider and every region:
 * the screens read the policy fields below and never branch on the provider.
 *
 * The policy fields are the whole design. Whether the payer sees the user's
 * name, whether a stranger may pay at all, whether a reference must travel
 * with the payment, whether the amount is fixed — each differs per corridor
 * today, and each changes what the UI is allowed to say.
 */

export type DepositProvider = 'bridge' | 'manteca'

export type DepositCorridor = 'ACH_US' | 'SEPA_EU' | 'FASTER_PAYMENTS_GB' | 'SPEI_MX' | 'PIX_BR' | 'BANK_TRANSFER_AR'

/**
 * `unclaimed` — the corridor is open to this user, no account exists yet.
 * `provisioning` — claimed, the provider has not returned details yet.
 * `active` — details are ready to share.
 * `unavailable` — the corridor cannot serve this user (region, provider).
 * `failed` — provisioning was attempted and did not complete.
 * `revoked` — the account existed and no longer accepts money. Distinct from
 *   `failed` on purpose: the details are in somebody else's payroll file, and
 *   Bridge returns anything sent to a deactivated account, so the user has to
 *   be told to stop handing them out rather than to try again.
 */
export type DepositAccountStatus =
    | 'unclaimed'
    | 'provisioning'
    | 'active'
    | 'retiring'
    | 'unavailable'
    | 'failed'
    | 'revoked'

/** whose name the payer reads on the account */
export type NameOnAccount = 'user' | 'provider'

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
export type SenderPolicy = 'anyone' | 'business-only' | 'own-name-only' | 'unknown'

/** whether a reference must travel with the payment for it to arrive */
export type MemoPolicy = 'none' | 'required'

/** whether the account accepts any amount or one agreed amount per payment */
export type AmountPolicy = 'flexible' | 'exact'

export interface DepositMatching {
    nameOnAccount: NameOnAccount
    sender: SenderPolicy
    memo: MemoPolicy
    amount: AmountPolicy
}

/**
 * Provider instructions, normalised. Every field is optional except the
 * holder name, because corridors genuinely differ: Mexican SPEI returns a
 * CLABE and no bank name at all, UK Faster Payments returns no beneficiary
 * name, and Argentine transfers return a CVU with a tax id. Presence is the
 * only reliable signal — never assume a field by currency.
 */
export interface DepositInstructions {
    accountHolderName: string
    beneficiaryName?: string
    beneficiaryAddress?: string
    bankName?: string
    bankAddress?: string
    iban?: string
    bic?: string
    accountNumber?: string
    routingNumber?: string
    sortCode?: string
    clabe?: string
    cvu?: string
    alias?: string
    taxId?: string
    memo?: string
    /** verbatim provider rail ids, e.g. ['ach_push', 'fednow', 'wire'] */
    paymentRails: string[]
}

/**
 * One account, exactly as `GET /users/deposit-accounts` returns it. The FE
 * adds nothing: `railId` carries the corridor, `matching` carries what the
 * screens are allowed to say, and the provider is deliberately absent.
 */
export interface DepositAccount {
    id: string
    /** `${provider}.${method}` — e.g. 'bridge.ach_us' */
    railId: string
    country: string
    /** ISO 4217, upper case: EUR */
    currency: string
    status: DepositAccountStatus
    /** the details we hand to a NEW payer; a retiring account is false */
    isPrimary: boolean
    matching: DepositMatching
    /** present once status is `active` */
    instructions?: DepositInstructions
}

/** presentation facts the provider payload does not carry */
export interface DepositRail {
    corridor: DepositCorridor
    currency: string
    provider: DepositProvider
    flagIso2: string
    /** how many rows the details card shows, so the provisioning skeleton matches it */
    detailRowCount: number
    /**
     * What we can honestly say about who may pay in, BEFORE an account exists.
     * The account's own `matching.sender` is the truth once it does.
     */
    expectedSender: SenderPolicy
    /**
     * Cap on one payment from a private person, where it is proved. Business
     * payers are exempt from Bridge's — quoting it as a flat third-party cap
     * would understate what an employer can send.
     */
    personCap?: string
    /** false where the corridor cannot be held as a reusable account */
    claimable?: false
    /** where a corridor that cannot be claimed does its real top-up instead */
    topUpHref?: string
}

/** every row a corridor can show; the label for each lives in the catalog */
export type DepositRowKey =
    | 'accountHolder'
    | 'taxId'
    | 'bank'
    | 'iban'
    | 'bic'
    | 'sortCode'
    | 'accountNumber'
    | 'routingNumber'
    | 'clabe'
    | 'cvu'
    | 'alias'
    | 'bankAddress'
    | 'beneficiaryAddress'
    | 'paymentReference'
    | 'accepts'

export type DepositRowLabels = Record<DepositRowKey, string>

export interface DepositDetailRow {
    key: DepositRowKey
    label: string
    value: string
    /** informational rows opt out of the copy button */
    copyable?: boolean
}

/** a payment that arrived and went back to the sender */
export interface ReturnedPayment {
    amount: string
    payer: string
    date: string
    /** the provider's reason, in words a user can act on */
    reason: string
}
