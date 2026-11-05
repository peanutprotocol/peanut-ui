import type { IOnrampData } from '@/context/OnrampFlowContext'
import { getCurrencyConfig } from '@/utils/bridge.utils'
import { formatBankAccountDisplay } from '@/utils/format.utils'

type DepositInstructions = NonNullable<IOnrampData['depositInstructions']>

/** The rail a bank top-up is paid over. It decides which bank details the payer copies. */
export type BankDepositRail = 'ach' | 'spei' | 'faster_payments' | 'sepa'

/** A bank detail the payer copies: its label (a `bankDetails` message key) and its value. */
export interface BankDepositAccountRow {
    label: 'sortCode' | 'accountNumber' | 'clabe' | 'iban' | 'bic' | 'routingNumber'
    /** Undefined while the API has not given this detail. */
    value?: string
    /** What the copy button copies, when it differs from what is shown: an IBAN shows in groups of four. */
    copyValue?: string
}

const RAIL_BY_CURRENCY: Record<string, BankDepositRail> = {
    usd: 'ach',
    mxn: 'spei',
    gbp: 'faster_payments',
    eur: 'sepa',
}

/**
 * The currency of a bank top-up, lowercase.
 *
 * The deposit instructions are the API's answer for this one transfer, so the
 * currency they name wins over the country in the URL. A route can lose the
 * country: until 2026-09-26 the native app read it from a path segment that
 * its routes do not have, so a UK top-up fell back to the US and showed
 * "$7.00" and an IBAN and BIC of "N/A", although the answer held the sort code
 * and the account number. The country is only a fallback for an answer
 * without a currency.
 */
export function bankDepositCurrency(
    instructions: DepositInstructions | undefined,
    countryId: string | undefined
): string {
    return instructions?.currency?.toLowerCase() || getCurrencyConfig(countryId || 'US', 'onramp').currency
}

/** The rail of a top-up currency. A currency not listed is paid like SEPA, as before. */
export function bankDepositRail(currency: string): BankDepositRail {
    return RAIL_BY_CURRENCY[currency.toLowerCase()] ?? 'sepa'
}

/**
 * The account rows of a top-up, each read from its own field of the deposit
 * instructions. A detail the API did not give stays undefined: the screen
 * shows "N/A" and offers no copy, rather than a field from another rail.
 */
export function bankDepositAccountRows(
    instructions: DepositInstructions | undefined,
    rail: BankDepositRail
): BankDepositAccountRow[] {
    if (rail === 'spei') return [{ label: 'clabe', value: instructions?.clabe }]
    if (rail === 'faster_payments') {
        return [
            { label: 'sortCode', value: instructions?.sortCode },
            { label: 'accountNumber', value: instructions?.accountNumber },
        ]
    }
    // ACH and SEPA: a US account and routing number where the API gives them, an IBAN and BIC otherwise
    const bankAccountNumber = instructions?.bankAccountNumber
    const iban = instructions?.iban
    return [
        {
            label: bankAccountNumber ? 'accountNumber' : 'iban',
            value: bankAccountNumber || (iban ? formatBankAccountDisplay(iban, 'iban') : undefined),
            copyValue: bankAccountNumber || iban,
        },
        {
            label: instructions?.bankRoutingNumber ? 'routingNumber' : 'bic',
            value: instructions?.bankRoutingNumber || instructions?.bic,
        },
    ]
}
