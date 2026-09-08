import { captureException } from '@sentry/nextjs'

export function qrTelemetry(data: string) {
    const qrKind = data.startsWith('000201')
        ? data.includes('br.gov.bcb.pix')
            ? 'pix'
            : 'emv'
        : /^https?:\/\//i.test(data)
          ? 'url'
          : data.length > 0 && data.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(data)
            ? 'base64-like'
            : 'other'
    const qrLengthBucket =
        data.length === 0
            ? 'empty'
            : data.length < 64
              ? '1-63'
              : data.length < 256
                ? '64-255'
                : data.length < 1024
                  ? '256-1023'
                  : '1024+'
    return { qrKind, qrLengthBucket }
}

export function reportQrScanError(data: string): void {
    captureException(new Error('QR scan processing failed'), {
        tags: { error_type: 'qr_scan_processing' },
        extra: qrTelemetry(data),
    })
}
