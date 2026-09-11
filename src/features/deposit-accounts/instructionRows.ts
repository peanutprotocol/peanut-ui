import type { DepositDetailRow, DepositInstructions, DepositRowKey, DepositRowLabels } from './types'

/**
 * Provider rail ids as a payer would name them. These are proper nouns —
 * SEPA and FedNow are the same word in every locale — so they stay here
 * rather than in the message catalog. An unmapped id falls back to a
 * readable form of the id itself, so a new Bridge rail shows up in review
 * instead of going silently missing.
 */
const RAIL_LABELS: Record<string, string> = {
    ach_push: 'ACH',
    fednow: 'FedNow',
    wire: 'Wire',
    sepa: 'SEPA',
    faster_payments: 'Faster Payments',
    spei: 'SPEI',
    transfer_ar: 'Bank transfer',
}

export function railLabel(rail: string): string {
    return RAIL_LABELS[rail] ?? rail.replace(/_/g, ' ')
}

export function acceptedRails(instructions: DepositInstructions): string {
    return instructions.paymentRails.map(railLabel).join(' · ')
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
export function instructionRowKeys(instructions: DepositInstructions): { key: DepositRowKey; value: string }[] {
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
    push('paymentReference', instructions.memo)

    if (instructions.paymentRails.length > 0) {
        rows.push({ key: 'accepts', value: acceptedRails(instructions) })
    }

    return rows
}

/** the same rows, labelled for display */
export function instructionRows(instructions: DepositInstructions, labels: DepositRowLabels): DepositDetailRow[] {
    return instructionRowKeys(instructions).map((row) => ({
        key: row.key,
        label: labels[row.key],
        value: row.value,
        // "Accepts" states what the account takes; there is nothing to paste
        copyable: row.key !== 'accepts',
    }))
}
