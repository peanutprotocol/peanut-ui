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

    it('is a fixed length no input can inflate', () => {
        /*
         * `t` comes straight off the URL. Embedding it in the clear let a
         * crafted /qr-pay link push the key past the backend's 200-character
         * bound, where `normalizeIdempotencyKey` drops it — silently restoring
         * the duplicate-lock behaviour this exists to prevent.
         */
        const short = qrInitIdempotencyKey({ qrCode: 'x', timestamp: '1' })
        const huge = qrInitIdempotencyKey({
            qrCode: 'x'.repeat(5_000),
            timestamp: '9'.repeat(5_000),
            amount: '1'.repeat(5_000),
        })
        expect(huge).toHaveLength(short.length)
        expect(huge.length).toBeLessThanOrEqual(200)
    })

    it('does not let adjacent fields blur into each other', () => {
        // A naive join makes (timestamp "1", qr "23") and (timestamp "12", qr "3") collide.
        expect(qrInitIdempotencyKey({ qrCode: '23', timestamp: '1' })).not.toBe(
            qrInitIdempotencyKey({ qrCode: '3', timestamp: '12' })
        )
        expect(qrInitIdempotencyKey({ qrCode: 'a', timestamp: '1', amount: '2' })).not.toBe(
            qrInitIdempotencyKey({ qrCode: 'a', timestamp: '1', amount: undefined })
        )
    })

    it('handles a missing timestamp without collapsing distinct QRs together', () => {
        expect(qrInitIdempotencyKey({ qrCode: PIX_QR, timestamp: null })).not.toBe(
            qrInitIdempotencyKey({ qrCode: PIX_QR.replace('9865', '1234'), timestamp: null })
        )
    })
})
