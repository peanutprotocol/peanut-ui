/**
 * The row set per residence and document answer, from the shape
 * GET /config/kyc-intents answers (TASK-23329). Residence reasons hide a
 * row; document reasons keep it, closed, with the reason.
 */
import type { KycIntentsConfig } from '@/services/kyc-intents'
import { defaultIntentSet, isQrOnly, unlockRows } from '../unlock-checklist.utils'

const open = { available: true }
const closed = (reason: string) => ({ available: false, reason })

const argentineDni: KycIntentsConfig = {
    residence: 'AR',
    intents: { qr: open, local: open, card: open, bank: open },
}

const venezuelanPassportInArgentina: KycIntentsConfig = {
    residence: 'AR',
    intents: {
        qr: open,
        local: closed('document_country_unsupported'),
        card: closed('document_country_unsupported'),
        bank: closed('document_country_unsupported'),
    },
}

const india: KycIntentsConfig = {
    residence: 'IN',
    intents: {
        qr: open,
        local: closed('local_residence_unsupported'),
        card: closed('geo-blocked'),
        bank: open,
    },
}

describe('unlockRows', () => {
    it('offers all four features to an Argentine resident with an Argentine DNI', () => {
        const rows = unlockRows(argentineDni)
        expect(rows.map((row) => row.key)).toEqual(['qr', 'local', 'card', 'bank'])
        expect(rows.every((row) => row.available)).toBe(true)
        expect(defaultIntentSet(rows)).toEqual({ qr: true, local: true, card: true, bank: true })
        expect(isQrOnly(rows)).toBe(false)
    })

    it('keeps QR only for a Venezuelan passport in Argentina, the rest closed by the document rule', () => {
        const rows = unlockRows(venezuelanPassportInArgentina)
        expect(rows[0]).toEqual({ key: 'qr', available: true })
        expect(rows.slice(1)).toEqual([
            { key: 'local', available: false, reason: 'document_country_unsupported' },
            { key: 'card', available: false, reason: 'document_country_unsupported' },
            { key: 'bank', available: false, reason: 'document_country_unsupported' },
        ])
        expect(defaultIntentSet(rows)).toEqual({ qr: true, local: false, card: false, bank: false })
        expect(isQrOnly(rows)).toBe(true)
    })

    it('hides the card and local rows a residence never has, like India', () => {
        const rows = unlockRows(india)
        expect(rows.map((row) => row.key)).toEqual(['qr', 'bank'])
        expect(isQrOnly(rows)).toBe(false)
    })

    it('sorts the rows the user can act on after the open ones', () => {
        const rows = unlockRows({
            residence: 'BR',
            intents: { qr: open, local: closed('local_tax_id_missing'), card: open, bank: open },
        })
        expect(rows.map((row) => row.key)).toEqual(['qr', 'card', 'bank', 'local'])
    })

    it('hides a closed row whose reason has no line of its own', () => {
        const rows = unlockRows({
            residence: 'AR',
            intents: { qr: open, local: closed('something_new'), card: open, bank: open },
        })
        expect(rows.map((row) => row.key)).toEqual(['qr', 'card', 'bank'])
    })
})
