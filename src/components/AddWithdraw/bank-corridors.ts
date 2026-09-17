import { BridgeAccountType } from '@/app/actions/types/users.types'
import { BRIDGE_ALPHA3_TO_ALPHA2 } from '@/components/AddMoney/consts'
import { isValidRoutingNumber, isValidSortCode, isValidUKAccountNumber } from '@/utils/bridge-accounts.utils'
import { validateMXCLabeAccount, validateUSBankAccount } from '@/utils/withdraw.utils'
import { MX_STATES, US_STATES } from '@/constants/stateCodes.consts'

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
    /** Options for the state field of an address, when the corridor has one. */
    states?: readonly { readonly name: string; readonly code: string }[]
    fields: BankCorridorField[]
}

const digits = (value: string) => value.replace(/[-\s]/g, '')

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
    needsAddress: false,
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
        states: MX_STATES,
        fields: [],
    },
    USA: {
        accountType: BridgeAccountType.US,
        accountField: 'accountNumber',
        accountLabelKey: 'accountNumber',
        accountRequiredKey: 'accountNumberRequired',
        accountInvalidKey: 'accountNumberInvalid',
        accountTest: (value) => validateUSBankAccount(value).isValid,
        needsAddress: true,
        states: US_STATES,
        fields: [
            {
                name: 'routingNumber',
                kind: 'input',
                labelKey: 'routingNumber',
                requiredKey: 'routingNumberRequired',
                invalidKey: 'routingNumberInvalid',
                test: isValidRoutingNumber,
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
        needsAddress: false,
        fields: [
            {
                name: 'sortCode',
                kind: 'input',
                labelKey: 'sortCode',
                requiredKey: 'sortCodeRequired',
                invalidKey: 'sortCodeInvalid',
                test: isValidSortCode,
                normalize: digits,
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

/** Countries that reach the same corridor under more than one code. */
const ALIASES: Record<string, string> = { GBR: 'GB', US: 'USA', COL: 'CO', MEX: 'MX' }

/**
 * The corridor a country withdraws through, or null when it has none.
 *
 * A SEPA country falls through to IBAN, which is what the euro area shares.
 */
export function bankCorridorFor(country: string): BankCorridorSpec | null {
    const code = ALIASES[country.toUpperCase()] ?? country.toUpperCase()
    const spec = SPECS[code]
    if (spec) return spec
    return BRIDGE_ALPHA3_TO_ALPHA2[code] !== undefined ? IBAN_SPEC : null
}
