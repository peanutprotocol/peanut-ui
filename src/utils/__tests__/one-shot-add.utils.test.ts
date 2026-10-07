/**
 * Adding a feature after the one-shot check (TASK-23329, item 8c, D16): the
 * tap adds to the stored set, never replaces it, and the PUT answer decides
 * what the sheet does next.
 */
import type { FeatureSetupReport } from '@/services/kyc-intents'
import { addIntent, addOutcome } from '@/utils/one-shot-add.utils'

const report = (overrides: Partial<FeatureSetupReport> = {}): FeatureSetupReport => ({
    qr: { state: 'on' },
    local: { state: 'not_requested' },
    card: { state: 'not_requested' },
    bank: { state: 'setting_up' },
    ...overrides,
})

describe('addIntent', () => {
    it('keeps the stored ticks and adds the tapped feature', () => {
        expect(addIntent({ qr: true, local: true, card: false, bank: false }, 'bank')).toEqual({
            qr: true,
            local: true,
            card: false,
            bank: true,
        })
    })

    it('ticks QR even when the stored set lost it', () => {
        expect(addIntent({ qr: false, local: false, card: true, bank: false }, 'local')).toEqual({
            qr: true,
            local: true,
            card: true,
            bank: false,
        })
    })

    it('starts from no ticks when nothing is stored', () => {
        expect(addIntent(null, 'bank')).toEqual({ qr: true, local: false, card: false, bank: true })
        expect(addIntent(undefined, 'qr')).toEqual({ qr: true, local: false, card: false, bank: false })
    })
})

describe('addOutcome', () => {
    const saved = (features?: FeatureSetupReport) => ({
        intents: { qr: true, local: false, card: false, bank: true },
        setAt: '2026-10-07T10:00:00.000Z',
        ...(features ? { features } : {}),
    })

    it('setting_up opens the setup drawer with the answer', () => {
        expect(addOutcome(saved(report()), 'bank')).toEqual({ kind: 'setup', report: report() })
    })

    it('on closes the sheet: the method is already available', () => {
        expect(addOutcome(saved(report({ bank: { state: 'on' } })), 'bank')).toEqual({ kind: 'on' })
    })

    it('refused carries the reason for the callout', () => {
        expect(
            addOutcome(saved(report({ bank: { state: 'refused', reason: 'document_country_unsupported' } })), 'bank')
        ).toEqual({ kind: 'refused', reason: 'document_country_unsupported' })
        expect(addOutcome(saved(report({ bank: { state: 'refused' } })), 'bank')).toEqual({ kind: 'refused' })
    })

    it('action_required opens the drawer, which shows the card step', () => {
        const card = report({ card: { state: 'action_required' } })
        expect(addOutcome(saved(card), 'card')).toEqual({ kind: 'setup', report: card })
    })

    it('pending stays on the sheet: the tick is saved, nothing is enabled yet', () => {
        expect(addOutcome(saved(report({ bank: { state: 'pending' } })), 'bank')).toEqual({ kind: 'pending' })
    })

    it('no features in the answer: the drawer reads the rails, as item 9a does', () => {
        expect(addOutcome(saved(), 'bank')).toEqual({ kind: 'setup', report: null })
    })
})
