import type { VaDetailRow, VaInstructions, VaRail } from './types'

/**
 * Normalised instructions → labelled rows, in payer order. Field precedence
 * mirrors TransactionDetails/provider-rows/BridgeDepositInstructions: IBAN+BIC
 * → sort code + account number → CLABE → US routing + account.
 */
export function instructionRows(instructions: VaInstructions, rail: VaRail): VaDetailRow[] {
    const rows: VaDetailRow[] = [
        { label: 'Account holder', value: instructions.beneficiaryName },
        { label: 'Bank', value: instructions.bankName },
    ]
    if (instructions.iban && instructions.bic) {
        rows.push({ label: 'IBAN', value: instructions.iban }, { label: 'BIC', value: instructions.bic })
    } else if (instructions.sortCode && instructions.accountNumber) {
        rows.push(
            { label: 'Sort code', value: instructions.sortCode },
            { label: 'Account number', value: instructions.accountNumber }
        )
    } else if (instructions.clabe) {
        rows.push({ label: 'CLABE', value: instructions.clabe })
    } else if (instructions.accountNumber && instructions.routingNumber) {
        rows.push(
            { label: 'Account number', value: instructions.accountNumber },
            { label: 'Routing number', value: instructions.routingNumber }
        )
    }
    if (instructions.bankAddress) rows.push({ label: 'Bank address', value: instructions.bankAddress })
    rows.push({ label: 'Accepted', value: rail.accepted, copy: false })
    return rows
}
