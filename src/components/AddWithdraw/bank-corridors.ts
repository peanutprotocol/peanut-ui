import { BridgeAccountType } from '@/app/actions/types/users.types'
import { BRIDGE_ALPHA3_TO_ALPHA2, countryData, type CountryData } from '@/components/AddMoney/consts'
import { isValidRoutingNumber, isValidSortCode, isValidUKAccountNumber } from '@/utils/bridge-accounts.utils'
import { getCountryCodeForWithdraw, validateMXCLabeAccount, validateUSBankAccount } from '@/utils/withdraw.utils'
import { MX_STATES, US_STATES } from '@/constants/stateCodes.consts'
import { type Account } from '@/interfaces/interfaces'

/**
 * What a bank account looks like in one country, in one place.
 *
 * The bank form used to ask `isMx`, `isUs`, `isUk`, `isIban` in five places —
 * to pick the account type, to label the account-number field, to decide which
 * extra field to render, to validate it and to build the payload. Each new
 * corridor meant finding all five. One entry here answers them all.
 */

/** A field only some corridors ask for. The name is also the payload key. */
export interface BankCorridorField {
    name:
        | 'routingNumber'
        | 'sortCode'
        | 'documentType'
        | 'documentNumber'
        | 'bankCode'
        | 'accountCategory'
        | 'phoneNumber'
    kind: 'input' | 'select'
    /** `withdraw.bankForm` message keys. */
    labelKey: string
    requiredKey: string
    invalidKey?: string
    /** A line under the control that stays until the field is wrong. */
    helperKey?: string
    /** Select options; the label is a `withdraw.bankForm` key. */
    options?: { value: string; labelKey: string }[]
    test?: (value: string) => boolean
    /** What reaches the payload, when it is not the typed value. */
    normalize?: (value: string) => string
    /**
     * Where a saved account keeps this detail. The same number at another bank
     * is another account, so a typed account reuses a saved one only when every
     * detail it asks for matches (TASK-23891).
     */
    savedValue?: (account: Account) => string | null | undefined
}

export interface BankCorridorSpec {
    accountType: BridgeAccountType
    /** The form field that carries the account number. */
    accountField: 'accountNumber' | 'clabe'
    accountLabelKey: string
    accountRequiredKey: string
    accountInvalidKey: string
    accountTest: (value: string) => boolean
    /** The provider needs a beneficiary address for this corridor. */
    needsAddress: boolean
    /**
     * Where an address for this corridor may be, ISO 3166-1 alpha-2. The euro
     * area is one corridor of many countries, so this is a set, not a country.
     * An address from outside it is not this account's address and is never
     * prefilled.
     *
     * Absent on a corridor that needs an address: the address is the account
     * owner's own, in any country, and the form asks which country.
     */
    addressCountries?: ReadonlySet<string>
    fields: BankCorridorField[]
}

const digits = (value: string) => value.replace(/[-\s]/g, '')

/**
 * Every country the euro-area corridor pays into, ISO 3166-1 alpha-2.
 *
 * `BRIDGE_ALPHA3_TO_ALPHA2` is the wider "Bridge knows this country" map and
 * carries US, GB, MX and CO as well — each of which has a corridor of its own
 * below. They are taken out here, or a US address would pass as a euro one.
 */
const SEPA_ALPHA2: ReadonlySet<string> = new Set(
    Object.values(BRIDGE_ALPHA3_TO_ALPHA2).filter((code) => !['US', 'GB', 'MX', 'CO'].includes(code))
)

const COLOMBIAN_FIELDS: BankCorridorField[] = [
    {
        name: 'documentType',
        kind: 'select',
        labelKey: 'documentType',
        requiredKey: 'documentTypeRequired',
        options: [
            { value: 'cc', labelKey: 'documentTypeCc' },
            { value: 'ce', labelKey: 'documentTypeCe' },
            { value: 'nit', labelKey: 'documentTypeNit' },
            { value: 'pp', labelKey: 'documentTypePp' },
        ],
    },
    {
        name: 'documentNumber',
        kind: 'input',
        labelKey: 'documentNumber',
        requiredKey: 'documentNumberRequired',
        invalidKey: 'documentNumberInvalid',
        test: (value) => /^\d{5,15}$/.test(digits(value)),
        normalize: digits,
    },
    {
        name: 'bankCode',
        kind: 'input',
        labelKey: 'bankCode',
        requiredKey: 'bankCodeRequired',
        invalidKey: 'bankCodeInvalid',
        helperKey: 'bankCodeHelper',
        test: (value) => /^\d{3,4}$/.test(digits(value)),
        normalize: digits,
    },
    {
        name: 'accountCategory',
        kind: 'select',
        labelKey: 'accountCategory',
        requiredKey: 'accountCategoryRequired',
        options: [
            { value: 'savings', labelKey: 'accountCategorySavings' },
            { value: 'checking', labelKey: 'accountCategoryChecking' },
        ],
    },
    {
        name: 'phoneNumber',
        kind: 'input',
        labelKey: 'phoneNumber',
        requiredKey: 'phoneNumberRequired',
        invalidKey: 'phoneNumberInvalid',
        helperKey: 'phoneNumberHelper',
        test: (value) => /^\+57\d{10}$/.test(digits(value)),
        normalize: digits,
    },
]

const IBAN_SPEC: BankCorridorSpec = {
    accountType: BridgeAccountType.IBAN,
    accountField: 'accountNumber',
    accountLabelKey: 'iban',
    accountRequiredKey: 'ibanRequired',
    accountInvalidKey: 'ibanInvalid',
    // The IBAN itself is checked against the provider — see the form.
    accountTest: () => true,
    // Bridge requires a beneficiary address on the SEPA payout body. SEPA has no
    // state concept, so the form collects street/city/postal and skips state.
    needsAddress: true,
    addressCountries: SEPA_ALPHA2,
    fields: [],
}

const SPECS: Record<string, BankCorridorSpec> = {
    MX: {
        accountType: BridgeAccountType.CLABE,
        accountField: 'clabe',
        accountLabelKey: 'clabe',
        accountRequiredKey: 'clabeRequired',
        accountInvalidKey: 'clabeInvalid',
        accountTest: (value) => validateMXCLabeAccount(value).isValid,
        needsAddress: true,
        addressCountries: new Set(['MX']),
        fields: [],
    },
    USA: {
        accountType: BridgeAccountType.US,
        accountField: 'accountNumber',
        accountLabelKey: 'accountNumber',
        accountRequiredKey: 'accountNumberRequired',
        accountInvalidKey: 'accountNumberInvalid',
        accountTest: (value) => validateUSBankAccount(value).isValid,
        // Bridge asks for the owner's address on a US account and takes one in
        // any country (apidocs: beneficiary address validation). A Wise USD
        // account held by someone in Lisbon has a Lisbon address.
        needsAddress: true,
        fields: [
            {
                name: 'routingNumber',
                kind: 'input',
                labelKey: 'routingNumber',
                requiredKey: 'routingNumberRequired',
                invalidKey: 'routingNumberInvalid',
                test: isValidRoutingNumber,
                savedValue: (account) => account.routingNumber,
            },
        ],
    },
    GB: {
        accountType: BridgeAccountType.GB,
        accountField: 'accountNumber',
        accountLabelKey: 'accountNumber',
        accountRequiredKey: 'accountNumberRequired',
        accountInvalidKey: 'accountNumberUk',
        accountTest: isValidUKAccountNumber,
        // Bridge requires a beneficiary address on the UK payout body. The UK
        // has no state concept, so the form collects street/city/postal only.
        needsAddress: true,
        addressCountries: new Set(['GB']),
        fields: [
            {
                name: 'sortCode',
                kind: 'input',
                labelKey: 'sortCode',
                requiredKey: 'sortCodeRequired',
                invalidKey: 'sortCodeInvalid',
                test: isValidSortCode,
                normalize: digits,
                // a UK row keeps its sort code in the routing number as well
                savedValue: (account) => account.sortCode ?? account.routingNumber,
            },
        ],
    },
    CO: {
        accountType: BridgeAccountType.CO_BANK_TRANSFER,
        accountField: 'accountNumber',
        accountLabelKey: 'accountNumber',
        accountRequiredKey: 'accountNumberRequired',
        accountInvalidKey: 'accountNumberCo',
        accountTest: (value) => /^\d{5,20}$/.test(digits(value)),
        // Colombia pays by document and bank code, with no beneficiary address.
        needsAddress: false,
        fields: COLOMBIAN_FIELDS,
    },
}

/**
 * The saved account the typed details name, if there is one: the same kind of
 * account, the same number, and the same value for every detail the corridor
 * asks for. A detail no saved account keeps cannot be compared, so it never
 * matches, and the API decides. `accountNumber` is the number as the payload
 * carries it.
 */
export function findSavedBankAccount(
    savedAccounts: readonly Account[],
    spec: BankCorridorSpec,
    accountNumber: string,
    details: Partial<Record<BankCorridorField['name'], string>>
): Account | undefined {
    const comparable = (value: string | null | undefined) => digits(value ?? '').toLowerCase()
    return savedAccounts.find(
        (account) =>
            (account.type as string) === spec.accountType &&
            comparable(account.identifier) === comparable(accountNumber) &&
            spec.fields.every((field) => {
                const saved = comparable(field.savedValue?.(account))
                return saved !== '' && saved === comparable(details[field.name])
            })
    )
}

/** Countries that reach the same corridor under more than one code. */
const ALIASES: Record<string, string> = { GBR: 'GB', US: 'USA', COL: 'CO', MEX: 'MX' }

/**
 * The euro area as ONE destination, because SEPA routes by IBAN.
 *
 * Every euro country shares the same corridor and the same form, and the IBAN's
 * first two characters already say which country it is — the form derives the
 * BIC from it the same way. Asking the user for the country first asked them
 * for something the next screen reads for itself, in terms a Revolut, Wise or
 * N26 customer genuinely does not know (QA round 2, Q2).
 *
 * It is not a member of `countryData`: it must never appear in a country list.
 */
export const SEPA_COUNTRY_CODE = 'SEPA'
export const SEPA_PATH = 'euro-area'
export const SEPA_DESTINATION: CountryData = {
    id: SEPA_COUNTRY_CODE,
    type: 'country',
    title: 'Euro bank account',
    currency: 'EUR',
    path: SEPA_PATH,
    region: 'europe',
}

/**
 * The corridor a country withdraws through, or null when it has none.
 *
 * A SEPA country falls through to IBAN, which is what the euro area shares.
 */
export function bankCorridorFor(country: string): BankCorridorSpec | null {
    const code = ALIASES[country.toUpperCase()] ?? country.toUpperCase()
    // the euro area answers as one IBAN corridor, with no country of its own
    if (code === SEPA_COUNTRY_CODE) return IBAN_SPEC
    const spec = SPECS[code]
    if (spec) return spec
    return BRIDGE_ALPHA3_TO_ALPHA2[code] !== undefined ? IBAN_SPEC : null
}

/**
 * Does this country have a live Bridge bank corridor?
 *
 * This is the single answer every money-out picker and the offramp route read
 * for "is a bank withdrawal wired here" — the corridor table decides it once,
 * so a corridor added above (Colombia's `co_bank_transfer`, a future SPEC, any
 * SEPA member) shows up in the withdraw list, the send-to-bank list, the claim
 * list and the `/withdraw/<country>/bank` gate at the same time, instead of
 * each keeping its own country list that forgets the new one. Manteca-only
 * countries (Argentina, Brazil) have no Bridge corridor and answer false; their
 * own rails gate them elsewhere.
 *
 * The id may be 2- or 3-letter, so it is normalised the same way the form does
 * before the lookup.
 */
export function hasBridgeBankCorridor(countryId: string): boolean {
    return bankCorridorFor(getCountryCodeForWithdraw(countryId)) !== null
}

/** Every catalog country's alpha-3 and alpha-2, both ways. */
const ALPHA3_TO_ALPHA2: Record<string, string> = Object.fromEntries(
    countryData
        .filter((country) => country.type === 'country' && country.iso2 && country.iso3)
        .map((country) => [country.iso3!.toUpperCase(), country.iso2!.toUpperCase()])
)
const ALPHA2_TO_ALPHA3: Record<string, string> = Object.fromEntries(
    Object.entries(ALPHA3_TO_ALPHA2).map(([alpha3, alpha2]) => [alpha2, alpha3])
)

/**
 * Alpha-2 for an address country given as alpha-2 or alpha-3.
 *
 * Bridge stores an external account's country as alpha-3, the verified-address
 * route answers alpha-2, and both feed the same check — so the two are made one
 * shape here rather than at each call site.
 */
export function addressCountryAlpha2(country: string | null | undefined): string | null {
    const code = (country ?? '').trim().toUpperCase()
    if (!code) return null
    if (code.length === 2) return code
    return ALPHA3_TO_ALPHA2[code] ?? null
}

/** Alpha-3 for an alpha-2 address country — the shape Bridge takes — or null when the catalog has no such country. */
export function addressCountryAlpha3(alpha2: string | null | undefined): string | null {
    return ALPHA2_TO_ALPHA3[(alpha2 ?? '').trim().toUpperCase()] ?? null
}

/**
 * The states an address in this country chooses from, or none.
 *
 * Bridge requires a state on a US address ("Must be supplied for US
 * addresses", external account API) and on an address in a country with
 * states (beneficiary address validation). Mexico's list is the one the CLABE
 * form always had.
 */
const STATES_BY_COUNTRY: Record<string, readonly { readonly name: string; readonly code: string }[]> = {
    US: US_STATES,
    MX: MX_STATES,
}

export function addressStatesFor(alpha2: string | null | undefined): readonly { name: string; code: string }[] {
    return STATES_BY_COUNTRY[(alpha2 ?? '').toUpperCase()] ?? []
}

/**
 * The country an address for this corridor is in, when the corridor fixes it:
 * Mexico for a CLABE, the UK for a sort code. Null when the form asks (the US
 * corridor) or the corridor spans many countries (the euro area).
 */
export function fixedAddressCountry(spec: BankCorridorSpec): string | null {
    return spec.addressCountries?.size === 1 ? [...spec.addressCountries][0] : null
}

/** Does the form ask which country the owner's address is in? */
export function asksAddressCountry(spec: BankCorridorSpec | null): boolean {
    return !!spec?.needsAddress && !spec.addressCountries
}

/**
 * May an address in `country` be prefilled into this corridor's form?
 *
 * An unknown country answers yes: the form asked for the address before any of
 * this existed, and refusing to fill one in because we could not name its
 * country would be a worse answer than the one the user has to type anyway.
 */
export function corridorAcceptsAddressCountry(spec: BankCorridorSpec, country: string | null | undefined): boolean {
    const code = addressCountryAlpha2(country)
    if (!code || !spec.addressCountries) return true
    return spec.addressCountries.has(code)
}

/**
 * Countries the provider refuses as a payout owner's address, ISO alpha-2.
 *
 * China only, and on evidence: a live production test (2026-10-11) had
 * `address.country=CHN` refused as "not supported" on an external account,
 * while HKG, TWN, SGP, CAN and GBR were taken. The provider's other
 * "unavailable" countries are about where a customer lives, not where an
 * account owner's address is, so they stay until a test says otherwise.
 *
 * This filters the bank form's own country list. The shared residence list
 * keeps China: a resident must be able to answer truthfully at signup.
 */
const REFUSED_OWNER_ADDRESS_COUNTRIES: ReadonlySet<string> = new Set(['CN'])

/** Can a payout owner's address be in this country (alpha-2 or alpha-3)? */
export function isOwnerAddressCountryAccepted(country: string | null | undefined): boolean {
    const code = addressCountryAlpha2(country)
    return !code || !REFUSED_OWNER_ADDRESS_COUNTRIES.has(code)
}

/** What is wrong with a US street line, as the provider reads it. */
export type UsStreetProblem = 'noNumber' | 'poBox'

// "PO Box", "P.O. Box", "POBox", "Post Office Box", "PMB", "Private Mailbox".
// A rural route ("RR 2 Box 152") is not matched: nobody has shown the
// provider refuses it.
const PO_BOX_PATTERN = /\b(?:p\.?\s*o\.?\s*box|post\s+office\s+box|pmb|private\s+mail\s*box)\b/i

/**
 * A US street line the provider will refuse, or null.
 *
 * The provider wants a street number on a US address, and no PO box or PMB
 * (external accounts API). It does not say the number comes first, and a strict
 * "starts with a digit" rule would refuse real addresses: "Apt 4B, 123 Main
 * St", Wisconsin and Utah grid addresses ("N123W456 Main Rd"), Puerto Rico
 * urbanizations ("Urb Las Gladiolas 150 Calle A"). So only a line with no digit
 * at all is refused for the number; see `usStreetLacksLeadingNumber` for the
 * softer check.
 */
export function usStreetProblem(street: string): UsStreetProblem | null {
    const value = street.trim()
    if (!value) return null
    if (PO_BOX_PATTERN.test(value)) return 'poBox'
    if (!/\d/.test(value)) return 'noNumber'
    return null
}

/**
 * Does a US street line not start with its number?
 *
 * Most US addresses do ("123 Main St"), and a line that starts elsewhere may
 * carry only a unit or a ZIP code the provider cannot use as the street
 * number. It is only a hint: the exceptions above are real addresses.
 */
export function usStreetLacksLeadingNumber(street: string): boolean {
    const value = street.trim()
    return !!value && !/^\d/.test(value)
}
