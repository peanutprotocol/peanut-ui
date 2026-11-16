import { isPixAccountType } from '@/components/TransactionDetails/transaction-details.utils'
import type { HistoryEntry } from '@/utils/history.utils'

/**
 * Whether a history entry moved money by Pix: a deposit, a withdrawal, a send to a key or a QR
 * payment, through any provider. A Pix transaction is named and shown by its method, not by its
 * provider (owner's ruling, 2026-11-15), so the Activity logo, the "Pix" titles and "Added by Pix"
 * all read this one rule.
 *
 * The API states the method in `paymentMethod`. An entry from an API without that field falls back
 * to fields the API sends on Pix transactions only. The currency is never the signal: it names the
 * money, not how it moved.
 */
export function isPixEntry(entry: Pick<HistoryEntry, 'extraData' | 'currency' | 'recipientAccount'>): boolean {
    const extra = entry.extraData
    if (!extra) return false
    if (extra.paymentMethod !== undefined) return extra.paymentMethod === 'PIX'
    // Avenia: a deposit carries `pixDeposit`; a withdrawal, a send and a QR payment carry `pixRecovery`
    if (extra.pixDeposit || extra.pixPayout || extra.pixRecovery !== undefined) return true
    // Manteca: the API sets a QR payment's currency from its QR rail (PIX_PAYMENT is BRL)
    if (extra.kind === 'QR_PAY' && extra.provider === 'MANTECA' && entry.currency?.code === 'BRL') return true
    const accountType = entry.recipientAccount?.type
    return !!accountType && isPixAccountType(accountType)
}
