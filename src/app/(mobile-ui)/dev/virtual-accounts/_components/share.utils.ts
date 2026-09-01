import type { VaDetailRow, VaRail } from './types'

/**
 * Payer-facing text for the share sheet. Mirrors the shape of
 * AddMoneyBankDetails.generateBankDetails (intro, "label: value" lines, outro).
 * `memo` null = matching.memo is 'none' and the reference lines are gone.
 */
export function buildShareText(rail: VaRail, rows: VaDetailRow[], memo: string | null): string {
    const lines = [
        `Here are my bank details to get paid in ${rail.code}:`,
        '',
        ...rows.filter((row) => row.copy !== false).map((row) => `${row.label}: ${row.value}`),
    ]
    if (memo) {
        lines.push(
            '',
            `Payment reference: ${memo}`,
            'Please put the reference in the reference or memo field of the transfer. Without it the payment is returned.'
        )
    }
    lines.push('', 'Sent from Peanut · peanut.me')
    return lines.join('\n')
}
