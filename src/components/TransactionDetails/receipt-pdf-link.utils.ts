import { isCapacitor, openExternalUrl } from '@/utils/capacitor'
import { shareableUrl } from '@/utils/url.utils'
import { fnv1a64 } from '@/utils/qr-payment.utils'
import type { TransactionDetails } from './transactionTransformer'

/** the pdf route path with the locale and receipt state in the url — the
 *  bytes vary by both and final receipts are cdn-cached by url (see the
 *  route's cache notes), so a refund or amount fix must change the url. */
export const receiptPdfPath = (entryId: string, kind: string, locale: string, version: string): `/${string}` =>
    `/receipt/${encodeURIComponent(entryId)}/pdf?kind=${encodeURIComponent(kind)}&locale=${encodeURIComponent(locale)}&v=${encodeURIComponent(version)}`

/**
 * the public-capability download path: a plain same-origin url. on web the
 * anchor download hits the cdn-cacheable route with cookie auth; in
 * capacitor there are no local api routes (static export), so the
 * production url opens in the system browser sheet. shared by the visible
 * download button and the more-actions drawer row so the two can never
 * diverge — the authenticated file hook is only for private kinds.
 */
export function openReceiptPdfUrl(pdfPath: `/${string}`): void {
    if (isCapacitor()) {
        void openExternalUrl(shareableUrl(pdfPath))
        return
    }
    const anchor = document.createElement('a')
    anchor.href = pdfPath
    anchor.download = ''
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
}

/** the receipt state the pdf renders; when it changes, a file fetched for the
 *  earlier state is outdated (pending → completed, refunds, amount or rate
 *  fixes, a new status date, tx hash or card dispute). it rides the pdf url,
 *  so it is an opaque digest — amounts and dates never land in request logs. */
export const receiptPdfVersion = (transaction: TransactionDetails): string =>
    fnv1a64(
        [
            transaction.status,
            transaction.amount,
            transaction.tokenAmount,
            transaction.currency?.amount,
            transaction.currency?.code,
            transaction.extraDataForDrawer?.receipt?.exchange_rate,
            transaction.extraDataForDrawer?.wasReturned,
            transaction.fee,
            transaction.date,
            transaction.completedAt,
            transaction.claimedAt,
            transaction.cancelledDate,
            transaction.txHash,
            transaction.extraDataForDrawer?.cardPayment?.dispute?.status,
        ].join('\u0000')
    )
