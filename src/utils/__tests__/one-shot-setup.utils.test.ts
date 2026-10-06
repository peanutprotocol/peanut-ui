/**
 * The setup drawer's rows (TASK-23329, item 9a): one per ticked feature, in
 * the three states of this item. Which rail serves which feature, and the
 * identity check coming first, are what item 9b builds on.
 */
import type { NextAction, RailCapability, UserCapabilities } from '@/types/capabilities'
import { setupRows } from '@/utils/one-shot-setup.utils'

const ALL = { qr: true, local: true, card: true, bank: true }

const rail = (overrides: Partial<RailCapability>): RailCapability => ({
    id: 'manteca.pix_br',
    provider: 'manteca',
    method: 'PIX_BR',
    channel: 'bank',
    country: 'BR',
    currency: 'BRL',
    status: 'pending',
    ...overrides,
})
const card = (overrides: Partial<RailCapability>) =>
    rail({
        id: 'rain.card_rain',
        provider: 'rain',
        method: 'CARD_RAIN',
        channel: 'card',
        country: 'GLOBAL',
        ...overrides,
    })
const sepa = (overrides: Partial<RailCapability>) =>
    rail({ id: 'bridge.sepa_eu', provider: 'bridge', method: 'SEPA_EU', country: 'EU', currency: 'EUR', ...overrides })

const capabilities = (rails: RailCapability[], nextActions: NextAction[] = []): UserCapabilities => ({
    rails,
    nextActions,
    restrictions: [],
})
const verified = (caps: UserCapabilities, intents = ALL) =>
    setupRows({ intents, capabilities: caps, identityVerified: true })

describe('setupRows', () => {
    it('gives one row per ticked feature, in checklist order', () => {
        const rows = setupRows({
            intents: { qr: true, local: false, card: true, bank: false },
            capabilities: undefined,
            identityVerified: false,
        })
        expect(rows.map((row) => row.key)).toEqual(['qr', 'card'])
    })

    it('reads every row as under review until the identity is verified, whatever a rail says', () => {
        const caps = capabilities([rail({ status: 'enabled', operations: { pay: 'enabled' } })])
        const rows = setupRows({ intents: ALL, capabilities: caps, identityVerified: false })
        expect(rows.map((row) => row.state)).toEqual(['under-review', 'under-review', 'under-review', 'under-review'])
    })

    it('verified with no rail yet: every row is setting up', () => {
        expect(verified(capabilities([])).map((row) => row.state)).toEqual([
            'setting-up',
            'setting-up',
            'setting-up',
            'setting-up',
        ])
    })

    it('a feature is available once its own operation is enabled on its rail', () => {
        const caps = capabilities([
            // the pool Pix rail pays while the first-party account is still being opened
            rail({ operations: { pay: 'enabled', deposit: 'pending', withdraw: 'pending' } }),
            card({ status: 'enabled', operations: { pay: 'enabled' } }),
            sepa({ status: 'enabled' }),
        ])
        expect(verified(caps)).toEqual([
            { key: 'qr', state: 'available' },
            { key: 'local', state: 'setting-up' },
            { key: 'card', state: 'available' },
            { key: 'bank', state: 'available' },
        ])
    })

    it('a rail waiting on a provider review reads under review; a blocked one stays setting up in this item', () => {
        const wait: NextAction = { key: 'wait:bridge', kind: 'wait', purpose: 'bridge-review' }
        const caps = capabilities(
            [
                sepa({ status: 'requires-info', blockingActions: ['wait:bridge'] }),
                card({
                    status: 'blocked',
                    resolved: {
                        status: 'blocked',
                        blocking: { code: 'region_block', userMessage: '', selfHealable: false },
                    },
                }),
            ],
            [wait]
        )
        expect(verified(caps, { qr: false, local: false, card: true, bank: true })).toEqual([
            { key: 'card', state: 'setting-up' },
            { key: 'bank', state: 'under-review' },
        ])
    })

    it('keeps each provider to its own feature: a Bridge account opens neither QR nor local transfers', () => {
        const caps = capabilities([sepa({ status: 'enabled' }), card({ status: 'enabled' })])
        expect(verified(caps, { qr: true, local: true, card: false, bank: false })).toEqual([
            { key: 'qr', state: 'setting-up' },
            { key: 'local', state: 'setting-up' },
        ])
    })
})
