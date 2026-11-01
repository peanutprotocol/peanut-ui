import type {
    FeatureReport,
    FeatureReportEntry,
    NextAction,
    RailCapability,
    RailChannel,
    RailOperation,
} from '@/types/capabilities'

/**
 * Reading the API's feature report (`capabilities.features`, api
 * `kyc/feature-report.ts`). The API decides what the user can do with each
 * feature and each bank account; every screen renders that answer through the
 * mappers here and decides nothing of its own (review item B5).
 */

/** `action` values that are not `nextActions` keys. */
export const VERIFY_ACTION = 'verify'
export const ACTIVATE_ACTION = 'activate'
/** On a refusal: the identity check made it, and the identity's own screen explains it. */
export const IDENTITY_ACTION = 'identity'

export type KycFeature = keyof FeatureReport

/** Manteca closed this country's account; only support can reopen it. */
export const MANTECA_ACCOUNT_REJECTED_REASON = 'manteca_account_rejected'

/** A report the API has not sent: nothing is offered and nothing is refused until it arrives. */
const UNKNOWN: FeatureReportEntry = { state: 'pending' }
export const UNKNOWN_REPORT: FeatureReport = {
    qr: UNKNOWN,
    local: { ...UNKNOWN, accounts: {} },
    bank: { ...UNKNOWN, accounts: {} },
    card: UNKNOWN,
}

/** The account a bank method opens. A catalog fact: which currency a rail carries. */
const METHOD_ACCOUNTS: Readonly<Record<string, { feature: 'bank' | 'local'; currency: string }>> = {
    ACH_US: { feature: 'bank', currency: 'USD' },
    SEPA_EU: { feature: 'bank', currency: 'EUR' },
    FASTER_PAYMENTS_GB: { feature: 'bank', currency: 'GBP' },
    SPEI_MX: { feature: 'bank', currency: 'MXN' },
    PIX_BR: { feature: 'local', currency: 'BRL' },
    BANK_TRANSFER_AR: { feature: 'local', currency: 'ARS' },
}

/** The account a bank country opens, as the rails name their jurisdiction. */
const COUNTRY_ACCOUNTS: Readonly<Record<string, { feature: 'bank' | 'local'; currency: string }>> = {
    US: METHOD_ACCOUNTS.ACH_US,
    EU: METHOD_ACCOUNTS.SEPA_EU,
    GB: METHOD_ACCOUNTS.FASTER_PAYMENTS_GB,
    MX: METHOD_ACCOUNTS.SPEI_MX,
    BR: METHOD_ACCOUNTS.PIX_BR,
    AR: METHOD_ACCOUNTS.BANK_TRANSFER_AR,
}

export interface ReportScope {
    channel?: RailChannel
    country?: string
    method?: string
    railId?: string
}

/** Unmapped currencies cannot inherit access from the overall feature. */
export function accountEntry(report: FeatureReport, feature: 'bank' | 'local', currency: string): FeatureReportEntry {
    const known = Object.values(METHOD_ACCOUNTS).some(
        (account) => account.feature === feature && account.currency === currency
    )
    return (
        report[feature].accounts[currency] ??
        (known ? report[feature] : { state: 'action_required', action: VERIFY_ACTION })
    )
}

/**
 * The entry a gate scope reads: the account a method, rail or country opens,
 * else the feature the operation is. Paying is QR (Manteca) or the card;
 * adding and withdrawing money are the bank accounts.
 */
export function reportEntry(
    report: FeatureReport,
    op: RailOperation,
    scope: ReportScope = {},
    rails: readonly RailCapability[] = []
): FeatureReportEntry {
    const rail = scope.railId ? rails.find((candidate) => candidate.id === scope.railId) : undefined
    const [providerOfId, methodOfId] = scope.railId?.split('.') ?? []
    const provider = rail?.provider ?? providerOfId
    const method = (scope.method ?? rail?.method ?? methodOfId)?.toUpperCase()
    if (provider === 'rain' || scope.channel === 'card') return report.card
    if (scope.channel === 'qr-only' || (op === 'pay' && provider === 'manteca')) return report.qr

    const country = scope.country?.toUpperCase()
    // A bank country outside the fixed six (Colombia) reads the account its own rail carries.
    const countryRail = country
        ? rails.find((candidate) => candidate.channel === 'bank' && candidate.country === country)
        : undefined
    const railAccount = rail ?? countryRail
    const account =
        (method ? METHOD_ACCOUNTS[method] : undefined) ??
        (railAccount
            ? { feature: railAccount.provider === 'manteca' ? 'local' : 'bank', currency: railAccount.currency }
            : undefined) ??
        (country ? COUNTRY_ACCOUNTS[country] : undefined)
    if (account) return accountEntry(report, account.feature as 'bank' | 'local', account.currency)
    if (scope.railId || scope.method || scope.country) return { state: 'action_required', action: VERIFY_ACTION }
    if (provider === 'manteca') return report.local
    if (provider === 'bridge') return report.bank
    if (op === 'pay' && !scope.channel) return report.qr
    // Any bank account: the bank feature, unless only the local one moves money.
    return report.bank.state !== 'on' && report.local.state === 'on' ? report.local : report.bank
}

/** The descriptor behind an entry's action, when it is a `nextActions` key. */
export function entryAction(entry: FeatureReportEntry, nextActions: readonly NextAction[]): NextAction | undefined {
    return entry.action ? nextActions.find((action) => action.key === entry.action) : undefined
}

/** Why an entry is refused; undefined while it is not. */
export function refusalOf(entry: FeatureReportEntry | undefined): string | undefined {
    return entry?.state === 'refused' ? entry.reason : undefined
}

/** Manteca closed this account: deposits and withdrawals there stop until support reopens it. */
export function isMantecaAccountClosed(entry: FeatureReportEntry | undefined): boolean {
    return refusalOf(entry) === MANTECA_ACCOUNT_REJECTED_REASON
}

/** A refusal only a person can lift (`duplicate_account`, `imported_identity_rejected`). */
const SUPPORT_CASE_REASONS: ReadonlySet<string> = new Set(['duplicate_account', 'imported_identity_rejected'])

export type EntryChip = 'active' | 'processing' | 'attention' | 'unlock' | 'notAvailable'

/**
 * A Money settings chip for an entry. Attention is a refusal the user can do
 * something about (a new identity check, a message to support); a refusal
 * with no way out is Not available.
 */
export function entryChip(entry: FeatureReportEntry, nextActions: readonly NextAction[]): EntryChip {
    switch (entry.state) {
        case 'on':
            return 'active'
        case 'refused':
            return entry.action || SUPPORT_CASE_REASONS.has(entry.reason ?? '') ? 'attention' : 'notAvailable'
        case 'action_required':
            if (entry.action === VERIFY_ACTION) return 'unlock'
            return entryAction(entry, nextActions)?.kind === 'restart-identity' ? 'attention' : 'processing'
        case 'setting_up':
        case 'pending':
            return 'processing'
        case 'ready':
            return 'unlock'
    }
}

/** Entries in the order a merged row reads them: the best one a user has decides the row. */
const CHIP_ORDER: readonly EntryChip[] = ['active', 'processing', 'attention', 'unlock', 'notAvailable']

export function bestChip(chips: readonly EntryChip[]): EntryChip {
    return CHIP_ORDER.find((chip) => chips.includes(chip)) ?? 'notAvailable'
}
