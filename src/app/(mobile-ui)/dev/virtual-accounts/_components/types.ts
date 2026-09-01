export type VaCurrency = 'usd' | 'eur' | 'gbp' | 'mxn'
export type VaScreen = 'pick' | 'details' | 'share'
/** prototype-only: which state the details screen renders */
export type VaState = 'ready' | 'pending' | 'unavailable' | 'returned' | 'failed' | 'kyc'

/**
 * Mirrors `deposit_accounts.matching` from
 * ops/plans/2026-09-01-virtual-accounts-bridge-everywhere.md §2.2 — the data
 * the UI reads instead of the provider or the SKU. The memo fork is
 * `memo: 'required' → 'none'` plus `nameOnAccount: 'provider' → 'user'`.
 */
export interface VaMatching {
    amount: 'flexible' | 'exact'
    memo: 'required' | 'none'
    sender: 'any' | 'own-name' | 'business-only'
    nameOnAccount: 'user' | 'provider'
}

/** `deposit_accounts.instructions`, normalised (plan §2.2); a subset per corridor */
export interface VaInstructions {
    beneficiaryName: string
    bankName: string
    bankAddress?: string
    iban?: string
    bic?: string
    routingNumber?: string
    accountNumber?: string
    clabe?: string
    sortCode?: string
    /** null when matching.memo === 'none' */
    memo: string | null
}

/** one item of `GET /users/deposit-accounts` (plan §2.3), as the screens consume it */
export interface DepositAccountView {
    corridor: string
    currency: string
    status: 'active' | 'provisioning' | 'unavailable'
    instructions: VaInstructions
    matching: VaMatching
}

export interface VaDetailRow {
    label: string
    value: string
    /** default true — informational rows opt out */
    copy?: boolean
}

/** presentation facts per corridor that the contract does not carry */
export interface VaRail {
    currency: VaCurrency
    corridor: string
    /** ISO code as shown to the user: EUR */
    code: string
    railName: string
    flagIso2: string
    /** picker row body — one short line, must not truncate at 375 */
    pickerBody: string
    /** rail-level: which payment types land on these details */
    accepted: string
    /** arrival + limits paragraph under the card */
    eta: string
    /** V1-only banner when matching.nameOnAccount === 'provider' */
    pooledHolderNotice: string
    /** the today-real failure: an off-amount deposit bounced */
    returnedExample: { amount: string; payer: string; date: string }
    /** the provider-side instructions as Bridge returns them today (V1) */
    v1: VaInstructions
    /** GBP / MXN were not in the 2026-08-24 PoC — values are placeholders */
    unverified?: boolean
}

export interface VaComingSoon {
    code: string
    railName: string
    flagIso2: string
}
