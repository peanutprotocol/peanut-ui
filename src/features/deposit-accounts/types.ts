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

export type DepositCorridor = 'USD_ACH' | 'EUR_SEPA' | 'GBP_FPS' | 'MXN_SPEI' | 'BRL_PIX' | 'ARS_TRANSFER'

/**
 * `unclaimed` — the corridor is open to this user, no account exists yet.
 * `provisioning` — claimed, the provider has not returned details yet.
 * `active` — details are ready to share.
 * `unavailable` — the corridor cannot serve this user (region, provider).
 * `failed` — provisioning was attempted and did not complete.
 */
export type DepositAccountStatus = 'unclaimed' | 'provisioning' | 'active' | 'unavailable' | 'failed'

/** whose name the payer reads on the account */
export type NameOnAccount = 'user' | 'provider'

/** who may pay into it */
export type SenderPolicy = 'anyone' | 'own-name-only'

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

export interface DepositAccount {
    corridor: DepositCorridor
    /** ISO 4217, upper case: EUR */
    currency: string
    provider: DepositProvider
    status: DepositAccountStatus
    matching: DepositMatching
    /** present once status is `active` */
    instructions?: DepositInstructions
}

/** presentation facts the provider payload does not carry */
export interface DepositRail {
    corridor: DepositCorridor
    currency: string
    provider: DepositProvider
    /** the rail a payer recognises: SEPA, Faster Payments, SPEI */
    railName: string
    flagIso2: string
    /** how many rows the details card shows, so the provisioning skeleton matches it */
    detailRowCount: number
    /** how much somebody else may send in one payment, where it is proved */
    thirdPartyCap?: string
    /** false where the corridor cannot be held as a reusable account */
    claimable?: false
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
