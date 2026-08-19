import { captureException } from '@sentry/nextjs'

type QrKind = 'pix' | 'emv' | 'url' | 'other'

// Coarse family of the payload, for filtering in Sentry.
function qrKind(data: string): QrKind {
    if (data.startsWith('000201')) return data.includes('br.gov.bcb.pix') ? 'pix' : 'emv'
    if (/^https?:\/\//i.test(data)) return 'url'
    return 'other'
}

/**
 * Reports an onScan throw to Sentry under its own tag so the family is
 * searchable (error_type:qr_scan_processing), with the full scanned payload.
 *
 * Deliberate: scan failures cannot be diagnosed without the payload, and it
 * carries payee/merchant data (Pix keys, merchant names), a claim link's
 * fragment, or whatever the paste path hands in. Sentry is a private processor
 * already trusted with user identity; the trade-off was accepted by the code
 * owner (PR #2757).
 */
export function reportQrScanError(err: unknown, data: string): void {
    captureException(err, {
        tags: { error_type: 'qr_scan_processing' },
        extra: { qrLength: data.length, qrKind: qrKind(data), qrPayload: data },
    })
}
