/**
 * The setup drawer's rows (TASK-23329, item 9a): one per ticked feature, in
 * the three states of this item. A row reads "Available" only when what its
 * name promises works, and the identity check comes first. Item 9b builds on
 * both.
 */
import type { NextAction, RailCapability, UserCapabilities } from '@/types/capabilities'
import { setupRows } from '@/utils/one-shot-setup.utils'

const ALL = { qr: true, local: true, card: true, bank: true }
const ONLY = (key: keyof typeof ALL) => ({ qr: false, local: false, card: false, bank: false, [key]: true })

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
const bridge = (method: string, country: string, currency: string, overrides: Partial<RailCapability> = {}) =>
    rail({ id: `bridge.${method.toLowerCase()}`, provider: 'bridge', method, country, currency, ...overrides })
const ach = (overrides?: Partial<RailCapability>) => bridge('ACH_US', 'US', 'USD', overrides)
const sepa = (overrides?: Partial<RailCapability>) => bridge('SEPA_EU', 'EU', 'EUR', overrides)

const capabilities = (rails: RailCapability[], nextActions: NextAction[] = []): UserCapabilities => ({
    rails,
    nextActions,
    restrictions: [],
})
const verified = (caps: UserCapabilities, intents = ALL, residence = 'BR') =>
    setupRows({ intents, residence, capabilities: caps, identityVerified: true })
const stateOf = (caps: UserCapabilities, key: keyof typeof ALL, residence = 'BR') =>
    verified(caps, ONLY(key), residence)[0].state

describe('setupRows', () => {
    it('gives one row per ticked feature, in checklist order', () => {
        const rows = setupRows({
            intents: { qr: true, local: false, card: true, bank: false },
            residence: 'BR',
            capabilities: undefined,
            identityVerified: false,
        })
        expect(rows.map((row) => row.key)).toEqual(['qr', 'card'])
    })

    it('reads every row as under review until the identity is verified, whatever a rail says', () => {
        const caps = capabilities([rail({ status: 'enabled', operations: { pay: 'enabled' } })])
        const rows = setupRows({ intents: ALL, residence: 'BR', capabilities: caps, identityVerified: false })
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
            ach({ status: 'enabled' }),
            sepa({ status: 'enabled' }),
        ])
        expect(verified(caps)).toEqual([
            { key: 'qr', state: 'available' },
            { key: 'local', state: 'setting-up' },
            { key: 'card', state: 'available' },
            { key: 'bank', state: 'available' },
        ])
    })

    describe('"USD and EUR accounts" needs both accounts', () => {
        it('one of the two alone is not available', () => {
            expect(stateOf(capabilities([ach({ status: 'enabled' }), sepa()]), 'bank')).toBe('setting-up')
            expect(stateOf(capabilities([sepa({ status: 'enabled' })]), 'bank')).toBe('setting-up')
        })

        it('an account in another currency never answers for it', () => {
            const gbp = bridge('FASTER_PAYMENTS_GB', 'GB', 'GBP', { status: 'enabled' })
            const mxn = bridge('SPEI_MX', 'MX', 'MXN', { status: 'enabled' })
            expect(stateOf(capabilities([gbp, mxn, ach(), sepa()]), 'bank')).toBe('setting-up')
        })

        it('reads under review while a provider reviews one of the two', () => {
            const wait: NextAction = { key: 'wait:bridge', kind: 'wait', purpose: 'bridge-review' }
            const caps = capabilities(
                [ach({ status: 'enabled' }), sepa({ status: 'requires-info', blockingActions: ['wait:bridge'] })],
                [wait]
            )
            expect(stateOf(caps, 'bank')).toBe('under-review')
        })
    })

    it('local bank transfers read the account of the residence, not another country', () => {
        const argentina = rail({
            id: 'manteca.bank_transfer_ar',
            method: 'BANK_TRANSFER_AR',
            country: 'AR',
            currency: 'ARS',
            status: 'enabled',
        })
        expect(stateOf(capabilities([argentina]), 'local', 'BR')).toBe('setting-up')
        expect(stateOf(capabilities([argentina]), 'local', 'AR')).toBe('available')
    })

    it('a blocked rail stays setting up in this item; item 9b gives it its own state', () => {
        const blocked = card({
            status: 'blocked',
            resolved: { status: 'blocked', blocking: { code: 'region_block', userMessage: '', selfHealable: false } },
        })
        expect(stateOf(capabilities([blocked]), 'card')).toBe('setting-up')
    })

    it('keeps each provider to its own feature: Bridge accounts open neither QR nor local transfers', () => {
        const caps = capabilities([ach({ status: 'enabled' }), sepa({ status: 'enabled' })])
        expect(verified(caps, { qr: true, local: true, card: false, bank: false })).toEqual([
            { key: 'qr', state: 'setting-up' },
            { key: 'local', state: 'setting-up' },
        ])
    })
})
