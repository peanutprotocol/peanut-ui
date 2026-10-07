/**
 * The setup drawer's rows (TASK-23329, item 9a): one per ticked feature, in
 * the three states of this item. A row reads "Available" only when what its
 * name promises works, and the identity check comes first. Item 9b builds on
 * both.
 */
import type { NextAction, RailCapability, UserCapabilities } from '@/types/capabilities'
import { localIdRestartAction, setupRows } from '@/utils/one-shot-setup.utils'

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

    it('a blocked rail with no step is not available', () => {
        const blocked = card({
            status: 'blocked',
            resolved: { status: 'blocked', blocking: { code: 'region_block', userMessage: '', selfHealable: false } },
        })
        expect(stateOf(capabilities([blocked]), 'card')).toBe('not-available')
    })

    it('keeps each provider to its own feature: Bridge accounts open neither QR nor local transfers', () => {
        const caps = capabilities([ach({ status: 'enabled' }), sepa({ status: 'enabled' })])
        expect(verified(caps, { qr: true, local: true, card: false, bank: false })).toEqual([
            { key: 'qr', state: 'setting-up' },
            { key: 'local', state: 'setting-up' },
        ])
    })
})

/** Item 9b: the states a user acts on, or must read. */
describe('setupRows, the states of item 9b', () => {
    const restart: NextAction = {
        key: 'restart-identity',
        kind: 'restart-identity',
        purpose: 'document_country_unsupported',
    }
    const otherRestart: NextAction = { key: 'restart-identity', kind: 'restart-identity', purpose: 'identity_missing' }

    it('a document asked by a provider reads document needed, with the step to upload it', () => {
        const upload: NextAction = {
            key: 'sumsub:proof_of_address',
            kind: 'sumsub',
            purpose: 'unlock-bridge',
            levelKey: 'proof_of_address',
        }
        const caps = capabilities(
            [
                ach({
                    status: 'requires-info',
                    blockingActions: [upload.key],
                    reason: { code: 'proof_of_address', userMessage: 'We need a proof of address' },
                }),
                sepa({ status: 'pending' }),
            ],
            [upload]
        )
        expect(verified(caps, ONLY('bank'))[0]).toEqual({
            key: 'bank',
            state: 'document-needed',
            step: { provider: 'bridge', action: upload, reasonCode: 'proof_of_address' },
        })
    })

    it('a document asked with no capability action still reads document needed (the resubmit route finds it)', () => {
        const caps = capabilities([
            rail({ status: 'requires-info', reason: { code: 'document_rejected', userMessage: 'Blurry photo' } }),
        ])
        expect(verified(caps, ONLY('local'))[0]).toEqual({
            key: 'local',
            state: 'document-needed',
            step: { provider: 'manteca', action: undefined, reasonCode: 'document_rejected' },
        })
    })

    it('a rail parked for the document country asks for a local ID', () => {
        const parked = card({
            status: 'blocked',
            blockingActions: [restart.key],
            reason: { code: 'document_country_unsupported', userMessage: 'needs a local document' },
        })
        expect(stateOf(capabilities([parked], [restart]), 'card')).toBe('needs-local-id')
    })

    it('a feature with no rail asks for a local ID when the orphan restart action says so', () => {
        // an Argentine resident on the QR pool: the pool rail pays and serves no account
        const pool = rail({
            id: 'manteca.qr_ar',
            method: 'QR_AR',
            channel: 'qr-only',
            country: 'AR',
            currency: 'ARS',
            operations: { pay: 'enabled' },
        })
        expect(verified(capabilities([pool], [restart]), ALL, 'AR')).toEqual([
            { key: 'qr', state: 'available' },
            { key: 'local', state: 'needs-local-id' },
            { key: 'card', state: 'needs-local-id' },
            { key: 'bank', state: 'needs-local-id' },
        ])
    })

    it('a restart for another purpose is not a local-ID ask', () => {
        const caps = capabilities([rail({ operations: { pay: 'enabled' } })], [otherRestart])
        expect(stateOf(caps, 'card')).toBe('setting-up')
        expect(localIdRestartAction(caps)).toBeUndefined()
        expect(localIdRestartAction(capabilities([], [restart]))).toEqual(restart)
    })

    it('a local-ID ask on the rail outranks a document ask and a wait on a sibling rail', () => {
        const wait: NextAction = { key: 'wait:bridge', kind: 'wait', purpose: 'bridge-review' }
        const caps = capabilities(
            [
                ach({ status: 'blocked', blockingActions: [restart.key], reason: { code: 'x', userMessage: '' } }),
                sepa({ status: 'requires-info', blockingActions: [wait.key] }),
            ],
            [restart, wait]
        )
        expect(stateOf(caps, 'bank')).toBe('needs-local-id')
    })

    describe('the card row follows the card step until its rail says available', () => {
        const only = ONLY('card')
        const rows = (
            card: Parameters<typeof setupRows>[0]['card'],
            caps = capabilities([]),
            identityVerified = true
        ) => setupRows({ intents: only, residence: 'BR', capabilities: caps, identityVerified, card })

        it('pending-identity reads setting up even while the identity is under review', () => {
            expect(rows({ kind: 'setting-up' }, capabilities([]), false)[0].state).toBe('setting-up')
        })

        it('open questions or agreements read agreements needed', () => {
            expect(rows({ kind: 'questions', token: 't' })[0].state).toBe('agreements-needed')
            expect(rows({ kind: 'agreements', isUsResident: false }, capabilities([]), false)[0].state).toBe(
                'agreements-needed'
            )
        })

        it.each([
            [{ kind: 'needs-local-id' } as const, 'needs-local-id'],
            [{ kind: 'checking' } as const, 'checking'],
            [{ kind: 'occupation-not-accepted' } as const, 'occupation-not-accepted'],
            [{ kind: 'not-available', message: 'm' } as const, 'not-available'],
        ])('%j reads %s', (chain, state) => {
            expect(rows(chain)[0].state).toBe(state)
        })

        it('an available rail wins over the card step', () => {
            const caps = capabilities([card({ status: 'enabled', operations: { pay: 'enabled' } })])
            expect(rows({ kind: 'agreements', isUsResident: false }, caps)[0].state).toBe('available')
        })

        it('an existing application or an error leaves the rail state', () => {
            expect(rows({ kind: 'applied', status: 'PENDING' })[0].state).toBe('setting-up')
            expect(rows({ kind: 'error', message: 'm' }, capabilities([]), false)[0].state).toBe('under-review')
        })

        it('the card step never touches the other rows', () => {
            const all = setupRows({
                intents: ALL,
                residence: 'BR',
                capabilities: capabilities([]),
                identityVerified: false,
                card: { kind: 'setting-up' },
            })
            expect(all.map((row) => row.state)).toEqual(['under-review', 'under-review', 'setting-up', 'under-review'])
        })
    })
})
