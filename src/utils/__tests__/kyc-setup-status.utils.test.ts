/**
 * The setup drawer's rows: one per feature saved on the document list. A row
 * reads "Available" only when what its name promises works, and the identity
 * check comes first. Ported from the one-shot setup rows (#3581).
 */
import type { NextAction, RailCapability, UserCapabilities } from '@/types/capabilities'
import { setupRows } from '@/utils/kyc-setup-status.utils'

const ALL = { qr: true, local: true, bank: true, card: true }
const ONLY = (key: keyof typeof ALL) => ({ qr: false, local: false, bank: false, card: false, [key]: true })

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
const verified = (caps: UserCapabilities, features = ALL, residence = 'BR') =>
    setupRows({ features, residence, capabilities: caps, identityVerified: true })
const stateOf = (caps: UserCapabilities, key: keyof typeof ALL, residence = 'BR') =>
    verified(caps, ONLY(key), residence)[0].state

describe('setupRows', () => {
    it('gives one row per saved feature, in the document list order', () => {
        const rows = setupRows({
            features: { qr: true, local: false, bank: true, card: true },
            residence: 'BR',
            capabilities: undefined,
            identityVerified: false,
        })
        expect(rows.map((row) => row.key)).toEqual(['qr', 'bank', 'card'])
    })

    it('reads every row as under review until the identity is verified, whatever a rail says', () => {
        const caps = capabilities([rail({ status: 'enabled', operations: { pay: 'enabled' } })])
        const rows = setupRows({ features: ALL, residence: 'BR', capabilities: caps, identityVerified: false })
        expect(rows.map((row) => row.state)).toEqual(['under-review', 'under-review', 'under-review', 'under-review'])
    })

    it('verified with no rail yet: QR, local transfers and accounts are setting up', () => {
        expect(verified(capabilities([]), { qr: true, local: true, bank: true, card: false })).toEqual([
            { key: 'qr', state: 'setting-up' },
            { key: 'local', state: 'setting-up' },
            { key: 'bank', state: 'setting-up' },
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
            { key: 'bank', state: 'available' },
            { key: 'card', state: 'available' },
        ])
    })

    describe('the accounts need both the USD and the EUR account', () => {
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

    it('keeps each provider to its own feature: Bridge accounts open neither QR nor local transfers', () => {
        const caps = capabilities([ach({ status: 'enabled' }), sepa({ status: 'enabled' })])
        expect(verified(caps, { qr: true, local: true, bank: false, card: false })).toEqual([
            { key: 'qr', state: 'setting-up' },
            { key: 'local', state: 'setting-up' },
        ])
    })
})
