import { captureException } from '@sentry/nextjs'

type QrKind = 'pix' | 'emv' | 'url' | 'other'

// Derived, PII-free shape of what was scanned. Raw payload excerpts are
// deliberately NOT sent: clipboard text, claim links and raw PIX keys can hold
// secrets, and even an EMVCo merchant payload embeds the payee's key.
function qrKind(data: string): QrKind {
    if (data.startsWith('000201')) return data.includes('br.gov.bcb.pix') ? 'pix' : 'emv'
    if (/^https?:\/\//i.test(data)) return 'url'
    return 'other'
}

/**
 * Reports an onScan throw to Sentry under its own tag so the family is
 * searchable (error_type:qr_scan_processing), with only derived,
 * non-sensitive context about the payload.
 */
export function reportQrScanError(err: unknown, data: string): void {
    captureException(err, {
        tags: { error_type: 'qr_scan_processing' },
        extra: { qrLength: data.length, qrKind: qrKind(data) },
    })
}
