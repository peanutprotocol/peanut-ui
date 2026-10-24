/**
 * The setup drawer's rows: one per saved feature. A row
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
const bridge = (method: string, country: string, currency: string, overrides: Partial<RailCapability> = {}) =>
    rail({ id: `bridge.${method.toLowerCase()}`, provider: 'bridge', method, country, currency, ...overrides })
const ach = (overrides?: Partial<RailCapability>) => bridge('ACH_US', 'US', 'USD', overrides)
const sepa = (overrides?: Partial<RailCapability>) => bridge('SEPA_EU', 'EU', 'EUR', overrides)
const gbp = (overrides?: Partial<RailCapability>) => bridge('FASTER_PAYMENTS_GB', 'GB', 'GBP', overrides)
const mxn = (overrides?: Partial<RailCapability>) => bridge('SPEI_MX', 'MX', 'MXN', overrides)

const capabilities = (rails: RailCapability[], nextActions: NextAction[] = []): UserCapabilities => ({
    rails,
    nextActions,
    restrictions: [],
})
const verified = (caps: UserCapabilities, features = ALL, residence = 'BR') =>
    setupRows({ features, residence, capabilities: caps, identityVerified: true })
const stateOf = (caps: UserCapabilities, key: keyof typeof ALL, residence = 'BR') =>
    verified(caps, ONLY(key), residence)[0].state

// Spec correction: item 4 says all enrolled Bridge bank rails, with at least one.
// Currency does not restrict membership in that set.
describe('bank availability follows every enrolled Bridge bank rail', () => {
    it.each([
        ['USD alone', [ach({ status: 'enabled' })]],
        ['EUR alone', [sepa({ status: 'enabled' })]],
        ['GBP alone', [gbp({ status: 'enabled' })]],
        ['MXN alone', [mxn({ status: 'enabled' })]],
        ['USD and EUR', [ach({ status: 'enabled' }), sepa({ status: 'enabled' })]],
        [
            'all four currencies',
            [
                ach({ status: 'enabled' }),
                sepa({ status: 'enabled' }),
                gbp({ status: 'enabled' }),
                mxn({ status: 'enabled' }),
            ],
        ],
        ['enabled Bridge with another provider pending', [ach({ status: 'enabled' }), rail({ status: 'pending' })]],
    ])('%s is available when every enrolled Bridge bank rail is enabled', (_label, rails) => {
        expect(stateOf(capabilities(rails), 'bank')).toBe('available')
    })
    it.each([
        ['none enrolled', []],
        ['only another provider', [rail({ status: 'enabled' })]],
        ['only a non-bank Bridge rail', [ach({ channel: 'card', status: 'enabled' })]],
        ['EUR still pending', [ach({ status: 'enabled' }), sepa()]],
        ['USD still pending', [ach(), sepa({ status: 'enabled' })]],
        ['GBP pending despite enabled USD and EUR', [ach({ status: 'enabled' }), sepa({ status: 'enabled' }), gbp()]],
        ['MXN pending despite enabled GBP', [gbp({ status: 'enabled' }), mxn()]],
    ])('%s cannot claim availability', (_label, rails) => {
        expect(stateOf(capabilities(rails), 'bank')).not.toBe('available')
    })
})
