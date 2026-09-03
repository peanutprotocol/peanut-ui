/**
 * The key that makes retrying `/manteca/qr-payment/init` safe.
 *
 * That POST creates a real Manteca price lock, and the client retries it on
 * timeout — the one case where the server may well have succeeded. The backend
 * replays the existing lock for a repeated key, so the only properties that
 * matter are: identical across one scan's attempts, different across scans, and
 * carrying none of the payment destination in the clear.
 */
import { qrInitIdempotencyKey } from '@/utils/qr-payment.utils'

const PIX_QR = '00020126580014BR.GOV.BCB.PIX0136some-pix-key@example.com5204000053039865802BR'

describe('qrInitIdempotencyKey', () => {
    it('is identical across the retries of one scan', () => {
        const a = qrInitIdempotencyKey({ qrCode: PIX_QR, timestamp: '1700000000' })
        const b = qrInitIdempotencyKey({ qrCode: PIX_QR, timestamp: '1700000000' })
        // Derived rather than random precisely so it also survives a remount.
        expect(a).toBe(b)
    })

    it('differs for a rescan of the same QR', () => {
        // Each scan gets a fresh `t` param, so the user genuinely wants a new lock.
        expect(qrInitIdempotencyKey({ qrCode: PIX_QR, timestamp: '1700000000' })).not.toBe(
            qrInitIdempotencyKey({ qrCode: PIX_QR, timestamp: '1700000001' })
        )
    })

    it('differs for a different QR scanned at the same instant', () => {
        expect(qrInitIdempotencyKey({ qrCode: PIX_QR, timestamp: '1700000000' })).not.toBe(
            qrInitIdempotencyKey({ qrCode: PIX_QR.replace('9865', '1234'), timestamp: '1700000000' })
        )
    })

    it('makes the amount part of the identity', () => {
        // An open-amount QR re-inits with the user's number; a different amount
        // is a different lock and must never replay the previous one.
        const base = { qrCode: PIX_QR, timestamp: '1700000000' }
        expect(qrInitIdempotencyKey({ ...base, amount: '100' })).not.toBe(
            qrInitIdempotencyKey({ ...base, amount: '50' })
        )
        expect(qrInitIdempotencyKey({ ...base, amount: '100' })).not.toBe(qrInitIdempotencyKey(base))
        expect(qrInitIdempotencyKey({ ...base, amount: '100' })).toBe(qrInitIdempotencyKey({ ...base, amount: '100' }))
    })

    it('never carries the payment destination in the clear', () => {
        // A Pix payload can encode a CPF, email or phone. It has no business
        // becoming a durable cache key in our database.
        const key = qrInitIdempotencyKey({ qrCode: PIX_QR, timestamp: '1700000000' })
        expect(key).not.toContain('some-pix-key@example.com')
        expect(key).not.toContain(PIX_QR)
    })

    it('stays within the backend’s 200-character key bound', () => {
        const key = qrInitIdempotencyKey({ qrCode: 'x'.repeat(5_000), timestamp: '1700000000', amount: '123.45' })
        // Longer than this and normalizeIdempotencyKey drops it, silently
        // restoring the un-guarded behaviour.
        expect(key.length).toBeLessThanOrEqual(200)
    })

    it('handles a missing timestamp without collapsing distinct QRs together', () => {
        expect(qrInitIdempotencyKey({ qrCode: PIX_QR, timestamp: null })).not.toBe(
            qrInitIdempotencyKey({ qrCode: PIX_QR.replace('9865', '1234'), timestamp: null })
        )
    })
})
