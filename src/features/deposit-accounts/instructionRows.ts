import type { DepositDetailRow, DepositInstructions, DepositRowKey, DepositRowLabels } from './types'

/**
 * How a payer names the rail their bank offers.
 *
 * SEPA, SPEI, Pix and FedNow are proper nouns and read the same in every
 * locale, but "Wire", "ACH" and "Bank transfer" are English sentences wearing
 * a proper noun's clothes — so the whole set is resolved from the message
 * catalog and a Spanish details card no longer mixes a Spanish label with an
 * English value.
 *
 * An id we do not know falls back to the catalog's generic bank-transfer
 * wording rather than to the raw id: `transfer_ar` in a user's face is worse
 * than a true but unspecific sentence, and a new Bridge rail is caught by the
 * catalog check, not by a user.
 */
export type RailLabels = Record<string, string> & { fallback: string }

export function railLabel(rail: string, labels: RailLabels): string {
    return labels[rail] ?? labels.fallback
}

export function acceptedRails(instructions: DepositInstructions, labels: RailLabels): string {
    // one rail named twice (two ids we do not know) says nothing twice
    const named = instructions.paymentRails.map((rail) => railLabel(rail, labels))
    return [...new Set(named)].join(' \u00b7 ')
}

/**
 * Which rows an account has, in the order a payer fills a transfer form:
 * who is paid, at which bank, into which account, and what the account
 * accepts.
 *
 * Presence decides, never currency. Mexican SPEI has no bank name; UK Faster
 * Payments has no beneficiary address; Argentine transfers carry a tax id no
 * other corridor has. A row appears when its field does.
 */
export function instructionRowKeys(
    instructions: DepositInstructions,
    railLabels: RailLabels
): { key: DepositRowKey; value: string }[] {
    const rows: { key: DepositRowKey; value: string }[] = [
        { key: 'accountHolder', value: instructions.accountHolderName },
    ]

    const push = (key: DepositRowKey, value: string | undefined) => {
        if (value) rows.push({ key, value })
    }

    push('taxId', instructions.taxId)
    push('bank', instructions.bankName)
    push('iban', instructions.iban)
    push('bic', instructions.bic)
    push('sortCode', instructions.sortCode)
    push('accountNumber', instructions.accountNumber)
    push('routingNumber', instructions.routingNumber)
    push('clabe', instructions.clabe)
    push('cvu', instructions.cvu)
    push('alias', instructions.alias)
    push('bankAddress', instructions.bankAddress)
    // the recipient's address, not the bank's — some payroll and bank forms
    // have a field for it, and without a row here a payer pastes the bank's
    push('beneficiaryAddress', instructions.beneficiaryAddress)
    push('paymentReference', instructions.memo)

    if (instructions.paymentRails.length > 0) {
        rows.push({ key: 'accepts', value: acceptedRails(instructions, railLabels) })
    }

    return rows
}

/** the same rows, labelled for display */
export function instructionRows(
    instructions: DepositInstructions,
    labels: DepositRowLabels,
    railLabels: RailLabels
): DepositDetailRow[] {
    return instructionRowKeys(instructions, railLabels).map((row) => ({
        key: row.key,
        label: labels[row.key],
        value: row.value,
        // "Accepts" states what the account takes; there is nothing to paste
        copyable: row.key !== 'accepts',
    }))
}
