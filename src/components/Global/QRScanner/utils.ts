import { captureException } from '@sentry/nextjs'

/**
 * Reports an onScan throw to Sentry under its own tag so the family is
 * searchable (error_type:qr_scan_processing). Only EMVCo merchant QRs carry a
 * payload excerpt — Pix / Mercado Pago / QR3 all start with the "000201"
 * payload-format indicator and hold machine-generated merchant data. Anything
 * else (clipboard text, claim links, raw PIX keys) could hold a secret or PII
 * and stays on-device; qrLength alone is still useful there.
 */
export function reportQrScanError(err: unknown, data: string): void {
    captureException(err, {
        tags: { error_type: 'qr_scan_processing' },
        extra: { qrLength: data.length, qrPrefix: data.startsWith('000201') ? data.slice(0, 64) : undefined },
    })
}
