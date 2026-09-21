import { isCapacitor, openExternalUrl } from '@/utils/capacitor'
import { shareableUrl } from '@/utils/url.utils'

/** the pdf route path with the locale in the url — the bytes vary by locale
 *  and final receipts are cdn-cached by url (see the route's cache notes). */
export const receiptPdfPath = (entryId: string, kind: string, locale: string): `/${string}` =>
    `/receipt/${encodeURIComponent(entryId)}/pdf?kind=${encodeURIComponent(kind)}&locale=${encodeURIComponent(locale)}`

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
