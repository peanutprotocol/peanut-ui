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

    it('verified with no rail yet, the card waits for its agreements on the card page', () => {
        expect(stateOf(capabilities([]), 'card')).toBe('agreements-needed')
        expect(verified(capabilities([]), ONLY('card'))[0].step).toEqual({ provider: 'rain' })
    })
})

/**
 * Every reason the capability resolver of api#1816 emits on these rails, as
 * the resolver emits it (status, reason, actions and its `resolved` verdict).
 */
describe('setupRows — the reasons of api#1816', () => {
    const support: NextAction = { key: 'contact-support', kind: 'contact-support', purpose: 'kyc-support' }
    const restart = (purpose: string, refused?: NextAction['refused']): NextAction => ({
        key: 'restart-identity',
        kind: 'restart-identity',
        purpose,
        ...(refused ? { refused } : {}),
    })
    const supplement: NextAction = { key: 'supplement:bridge', kind: 'sumsub', purpose: 'requirements_missing' }
    const verdictOf = (
        status: NonNullable<RailCapability['resolved']>['status'],
        code: string,
        nextAction?: NextAction,
        selfHealKind?: 'document-resubmit' | 'restart-identity' | 'provide-email' | 'contact-support'
    ): RailCapability['resolved'] => ({
        status,
        blocking: {
            code,
            userMessage: '',
            selfHealable: status === 'fixable' || selfHealKind === 'restart-identity',
            ...(selfHealKind ? { selfHealKind } : {}),
        },
        ...(nextAction ? { nextAction } : {}),
    })
    /** Both accounts parked the same way. */
    const accounts = (overrides: Partial<RailCapability>) => [ach(overrides), sepa(overrides)]
    const bankState = (
        rails: RailCapability[],
        nextActions: NextAction[],
        submitted?: Parameters<typeof setupRows>[0]['submitted']
    ) =>
        setupRows({
            features: ONLY('bank'),
            residence: 'BR',
            capabilities: capabilities(rails, nextActions),
            identityVerified: true,
            submitted,
        })[0]

    it('requirements_missing on its supplement: Document needed, the step is the supplement action', () => {
        const row = bankState(
            accounts({
                status: 'blocked',
                reason: { code: 'requirements_missing', userMessage: '' },
                blockingActions: ['supplement:bridge'],
                resolved: verdictOf('fixable', 'requirements_missing', supplement, 'document-resubmit'),
            }),
            [supplement]
        )
        expect(row).toEqual({
            key: 'bank',
            state: 'document-needed',
            reason: 'requirements_missing',
            step: { provider: 'bridge', action: supplement, reasonCode: 'requirements_missing' },
        })
    })

    it('requirements_in_review: Under review, with the proof of address line', () => {
        const row = bankState(
            accounts({
                status: 'pending',
                reason: { code: 'requirements_in_review', userMessage: '' },
                blockingActions: [],
                resolved: { status: 'pending' },
            }),
            []
        )
        expect(row).toEqual({ key: 'bank', state: 'under-review', reason: 'requirements_in_review' })
    })

    it('a proof of address sent in this flow reads under review before the rail catches up', () => {
        const row = bankState(
            accounts({
                status: 'blocked',
                reason: { code: 'requirements_missing', userMessage: '' },
                blockingActions: ['supplement:bridge'],
                resolved: verdictOf('fixable', 'requirements_missing', supplement, 'document-resubmit'),
            }),
            [supplement],
            { supplements: new Set(['supplement:bridge']) }
        )
        expect(row).toEqual({ key: 'bank', state: 'under-review', reason: 'requirements_in_review' })
    })

    it('identity_document_insufficient: Verify ID, through a new identity check', () => {
        const action = restart('identity_document_insufficient', [
            { provider: 'bridge', reason: 'identity_document_insufficient' },
        ])
        const row = bankState(
            accounts({
                status: 'blocked',
                reason: { code: 'identity_document_insufficient', userMessage: '' },
                blockingActions: ['restart-identity'],
                resolved: verdictOf('blocked', 'identity_document_insufficient', action, 'restart-identity'),
            }),
            [action]
        )
        expect(row).toEqual({ key: 'bank', state: 'verify-again', reason: 'identity_document_insufficient' })
    })

    it('requirements_uncollectable: Not available, and support can finish it', () => {
        const row = bankState(
            accounts({
                status: 'blocked',
                reason: { code: 'requirements_uncollectable', userMessage: '' },
                blockingActions: ['contact-support'],
                resolved: verdictOf('blocked', 'requirements_uncollectable', support, 'contact-support'),
            }),
            [support]
        )
        expect(row).toEqual({
            key: 'bank',
            state: 'not-available',
            reason: 'requirements_uncollectable',
            support: true,
        })
    })

    describe('plan refusals (PROVIDER_NOT_IN_PLAN)', () => {
        it('document_country_unsupported on a parked rail: needs an ID issued by the residence', () => {
            const action = restart('document_country_unsupported', [
                { provider: 'bridge', reason: 'document_country_unsupported' },
            ])
            const row = bankState(
                accounts({
                    status: 'blocked',
                    reason: { code: 'document_country_unsupported', userMessage: '' },
                    blockingActions: ['restart-identity'],
                    resolved: verdictOf('blocked', 'document_country_unsupported', action, 'restart-identity'),
                }),
                [action]
            )
            expect(row).toEqual({ key: 'bank', state: 'needs-local-id', reason: 'document_country_unsupported' })
        })

        it('the orphan restart names the refused provider: Bridge refused, the accounts ask for a local ID', () => {
            const action = restart('document_country_unsupported', [
                { provider: 'bridge', reason: 'document_country_unsupported' },
            ])
            const pix = rail({ status: 'enabled', operations: { pay: 'enabled', deposit: 'enabled' } })
            const rows = setupRows({
                features: ALL,
                residence: 'BR',
                capabilities: capabilities([pix], [action]),
                identityVerified: true,
            })
            expect(rows).toEqual([
                { key: 'qr', state: 'available' },
                { key: 'local', state: 'available' },
                { key: 'bank', state: 'needs-local-id', reason: 'document_country_unsupported' },
                { key: 'card', state: 'agreements-needed', step: { provider: 'rain' } },
            ])
        })

        it('Rain refused for the document country: the card asks for a local ID', () => {
            const action = restart('document_country_unsupported', [
                { provider: 'rain', reason: 'document_country_unsupported' },
            ])
            expect(stateOf(capabilities([], [action]), 'card')).toBe('needs-local-id')
        })

        it('an API that names no refused provider: the accounts or card with no rail of their own ask for a local ID', () => {
            const rows = setupRows({
                features: { qr: true, local: false, bank: true, card: false },
                residence: 'BR',
                capabilities: capabilities(
                    [rail({ status: 'enabled', operations: { pay: 'enabled' } })],
                    [restart('document_country_unsupported')]
                ),
                identityVerified: true,
            })
            expect(rows.map((row) => row.state)).toEqual(['available', 'needs-local-id'])
        })

        describe('a row whose own operation is enabled reads Available, whatever a provider-wide answer says', () => {
            it.each([
                ['bank', 'bridge', [ach({ status: 'enabled' }), sepa({ status: 'enabled' })]],
                ['card', 'rain', [card({ status: 'enabled', operations: { pay: 'enabled' } })]],
                ['qr', 'manteca', [rail({ status: 'enabled', operations: { pay: 'enabled', deposit: 'pending' } })]],
            ] as const)('%s with %s refused provider-wide', (key, provider, rails) => {
                const action = restart('document_country_unsupported', [
                    { provider, reason: 'document_country_unsupported' },
                ])
                expect(stateOf(capabilities([...rails], [action]), key)).toBe('available')
            })
        })

        describe('document_country_unsupported only where it can occur: the accounts and the card', () => {
            it('a refused Manteca named by the restart action closes neither QR nor local transfers', () => {
                const action = restart('document_country_unsupported', [
                    { provider: 'manteca', reason: 'document_country_unsupported' },
                ])
                const rows = setupRows({
                    features: { qr: true, local: true, bank: false, card: false },
                    residence: 'BR',
                    capabilities: capabilities([], [action]),
                    identityVerified: true,
                })
                expect(rows.map((row) => row.state)).toEqual(['setting-up', 'setting-up'])
            })

            it('the reason on a Manteca rail is a plain new identity check, with no local-ID line', () => {
                const action = restart('document_country_unsupported')
                const row = setupRows({
                    features: ONLY('local'),
                    residence: 'BR',
                    capabilities: capabilities(
                        [
                            rail({
                                status: 'blocked',
                                reason: { code: 'document_country_unsupported', userMessage: '' },
                                blockingActions: ['restart-identity'],
                                resolved: verdictOf(
                                    'blocked',
                                    'document_country_unsupported',
                                    action,
                                    'restart-identity'
                                ),
                            }),
                        ],
                        [action]
                    ),
                    identityVerified: true,
                })[0]
                expect(row).toEqual({ key: 'local', state: 'verify-again' })
            })
        })

        describe('a refused Manteca account closes local transfers; only the pool reasons close QR', () => {
            const parkedBank = (code: string) =>
                rail({
                    id: 'manteca.bank_transfer_ar',
                    method: 'BANK_TRANSFER_AR',
                    country: 'AR',
                    currency: 'ARS',
                    status: 'blocked',
                    reason: { code, userMessage: '' },
                    resolved: verdictOf('blocked', code),
                })
            const qrPool = rail({
                id: 'manteca.mercadopago_qr_ar',
                method: 'MERCADOPAGO_QR_AR',
                channel: 'qr-only',
                country: 'AR',
                currency: 'ARS',
                status: 'enabled',
                operations: { pay: 'enabled' },
            })
            const rowsFor = (rails: RailCapability[]) =>
                setupRows({
                    features: { qr: true, local: true, bank: false, card: false },
                    residence: 'AR',
                    capabilities: capabilities(rails),
                    identityVerified: true,
                })

            it.each([
                'local_tax_id_missing',
                'manteca_us_nationality_restricted',
                'local_residence_unsupported',
                'residence_unknown',
            ])('%s: QR available on the pool, local transfers not available', (code) => {
                expect(rowsFor([qrPool, parkedBank(code)])).toEqual([
                    { key: 'qr', state: 'available' },
                    { key: 'local', state: 'not-available', reason: code },
                ])
            })

            it('the same refusal on the only Manteca rail leaves QR setting up, never closed', () => {
                const pix = rail({
                    status: 'blocked',
                    reason: { code: 'local_tax_id_missing', userMessage: '' },
                    resolved: verdictOf('blocked', 'local_tax_id_missing'),
                })
                expect(verified(capabilities([pix]), { qr: true, local: true, bank: false, card: false })).toEqual([
                    { key: 'qr', state: 'setting-up' },
                    { key: 'local', state: 'not-available', reason: 'local_tax_id_missing' },
                ])
            })

            it.each(['under_minimum_age', 'residence_sanctioned'])('%s closes QR as well', (code) => {
                expect(rowsFor([parkedBank(code)])).toEqual([
                    { key: 'qr', state: 'not-available', reason: code },
                    { key: 'local', state: 'not-available', reason: code },
                ])
            })

            it('a pool reason never closes QR while a QR rail pays', () => {
                expect(rowsFor([qrPool, parkedBank('under_minimum_age')])[0]).toEqual({ key: 'qr', state: 'available' })
            })
        })

        it.each([
            'under_minimum_age',
            'residence_unknown',
            'residence_sanctioned',
            'uk_resident_blocked',
            'residence_bank_restricted',
            'us_state_unsupported',
            'geo-blocked',
            'local_residence_unsupported',
            'manteca_us_nationality_restricted',
            'local_tax_id_missing',
        ])('%s: Not available, with the reason and no support (support cannot change a plan)', (code) => {
            const row = bankState(
                accounts({
                    status: 'blocked',
                    reason: { code, userMessage: '' },
                    resolved: verdictOf('blocked', code),
                }),
                []
            )
            expect(row).toEqual({ key: 'bank', state: 'not-available', reason: code })
        })

        it('not_requested on a feature the user did save: setting up, the next save of the set sends it', () => {
            const row = bankState(
                accounts({
                    status: 'blocked',
                    reason: { code: 'not_requested', userMessage: '' },
                    resolved: verdictOf('blocked', 'not_requested'),
                }),
                []
            )
            expect(row.state).toBe('setting-up')
        })
    })

    describe('the bank terms', () => {
        const tos: NextAction = { key: 'accept-tos', kind: 'accept-tos', purpose: 'accept-bridge-tos' }
        const parkedOnTerms = accounts({
            status: 'requires-info',
            reason: { code: 'bridge_tos_required', userMessage: '' },
            blockingActions: ['accept-tos'],
            resolved: verdictOf('fixable', 'bridge_tos_required', tos),
        })

        it.each(['bridge_tos_required', 'bridge_tos_v2_required'])('%s: Terms needed on the terms step', (code) => {
            const row = bankState(
                accounts({
                    status: 'requires-info',
                    reason: { code, userMessage: '' },
                    blockingActions: ['accept-tos'],
                    resolved: verdictOf('fixable', code, tos),
                }),
                [tos]
            )
            expect(row).toEqual({
                key: 'bank',
                state: 'terms-needed',
                reason: code,
                step: { provider: 'bridge', action: tos },
            })
        })

        it('terms accepted in this flow read setting up before the rails catch up', () => {
            expect(bankState(parkedOnTerms, [tos], { terms: true }).state).toBe('setting-up')
        })
    })

    it.each([
        ['bridge_processing', 'bridge-review'],
        ['identity_reverification_pending', 'identity-reverification'],
    ])('%s: Under review while a provider or the identity check decides', (code, purpose) => {
        const wait: NextAction = { key: `wait:${purpose}`, kind: 'wait', purpose }
        const row = bankState(
            accounts({
                status: 'requires-info',
                reason: { code, userMessage: '' },
                blockingActions: [wait.key],
                resolved: { status: 'pending', nextAction: wait },
            }),
            [wait]
        )
        expect(row).toEqual({ key: 'bank', state: 'under-review', reason: code })
    })

    it.each([
        ['residence_unresolved', 'sumsub:address_of_residence'],
        ['proof_of_address', 'sumsub:proof_of_address'],
        ['tax_identification_number', 'sumsub:tax_identification_number'],
        ['eea_uplift_with_tin', 'sumsub:eea_uplift_with_tin'],
    ])('%s: Document needed, on its own action', (code, key) => {
        const action: NextAction = { key, kind: 'sumsub', purpose: 'unlock-bridge' }
        const row = bankState(
            accounts({
                status: code === 'residence_unresolved' ? 'blocked' : 'requires-info',
                reason: { code, userMessage: '' },
                blockingActions: [key],
                resolved: verdictOf('fixable', code, action, 'document-resubmit'),
            }),
            [action]
        )
        expect(row).toEqual({
            key: 'bank',
            state: 'document-needed',
            reason: code,
            step: { provider: 'bridge', action, reasonCode: code },
        })
    })

    it('document_rejected with no action: Document needed, on the resubmit route', () => {
        const row = bankState(
            accounts({
                status: 'requires-info',
                reason: { code: 'document_rejected', userMessage: '' },
                resolved: verdictOf('fixable', 'document_rejected', undefined, 'document-resubmit'),
            }),
            []
        )
        expect(row).toEqual({
            key: 'bank',
            state: 'document-needed',
            reason: 'document_rejected',
            step: { provider: 'bridge', reasonCode: 'document_rejected' },
        })
    })

    it.each(['manteca_action_expired', 'manteca_action_correction_required'])(
        '%s: Document needed on the Manteca action of the residence',
        (code) => {
            const action: NextAction = { key: 'manteca-kyc-action:BR', kind: 'sumsub', purpose: 'unlock-manteca-bank' }
            const row = setupRows({
                features: ONLY('local'),
                residence: 'BR',
                capabilities: capabilities(
                    [
                        rail({
                            status: 'requires-info',
                            operations: { pay: 'enabled', deposit: 'pending', withdraw: 'pending' },
                            reason: { code, userMessage: '' },
                            blockingActions: [action.key],
                            resolved: verdictOf('fixable', code, action, 'document-resubmit'),
                        }),
                    ],
                    [action]
                ),
                identityVerified: true,
            })[0]
            expect(row).toEqual({
                key: 'local',
                state: 'document-needed',
                reason: code,
                step: { provider: 'manteca', action, reasonCode: code },
            })
        }
    )

    it.each(['tax_id_unresolved', 'country_not_supported', 'identity_missing'])(
        '%s: Verify ID, through a new identity check',
        (code) => {
            const action = restart(code)
            const row = setupRows({
                features: ONLY('local'),
                residence: 'BR',
                capabilities: capabilities(
                    [
                        rail({
                            status: 'blocked',
                            reason: { code, userMessage: '' },
                            blockingActions: ['restart-identity'],
                            resolved: verdictOf('blocked', code, action, 'restart-identity'),
                        }),
                    ],
                    [action]
                ),
                identityVerified: true,
            })[0]
            expect(row).toEqual({ key: 'local', state: 'verify-again', reason: code })
        }
    )

    it.each([
        'submission_failed',
        'verification_blocked',
        'terminal_rejection',
        'bridge_terminal_rejection',
        'duplicate_customer_detected',
        'residence_bank_restricted',
    ])('%s with a support action: Not available, support can open it', (code) => {
        const row = bankState(
            accounts({
                status: 'blocked',
                reason: { code, userMessage: '' },
                blockingActions: ['contact-support'],
                resolved: verdictOf('blocked', code, support, 'contact-support'),
            }),
            [support]
        )
        expect(row).toEqual({ key: 'bank', state: 'not-available', reason: code, support: true })
    })

    it.each(['uk_resident_blocked', 'residence_bank_restricted'])(
        '%s from the residence gate: Not available, no support',
        (code) => {
            const row = bankState(
                accounts({
                    status: 'blocked',
                    reason: { code, userMessage: '' },
                    resolved: verdictOf('blocked', code),
                }),
                []
            )
            expect(row).toEqual({ key: 'bank', state: 'not-available', reason: code })
        }
    )

    it('manteca_us_nationality: QR stays available, local transfers are not available', () => {
        const restricted = rail({
            status: 'enabled',
            operations: { pay: 'enabled', deposit: 'blocked', withdraw: 'blocked' },
            reason: { code: 'manteca_us_nationality', userMessage: '' },
            resolved: { status: 'enabled' },
        })
        expect(verified(capabilities([restricted]), { qr: true, local: true, bank: false, card: false })).toEqual([
            { key: 'qr', state: 'available' },
            { key: 'local', state: 'not-available', reason: 'manteca_us_nationality' },
        ])
    })

    it('email_required has no drawer state: it reads setting up (Home asks for the email)', () => {
        const email: NextAction = { key: 'provide-email', kind: 'provide-email', purpose: 'submission-failed-no-email' }
        const row = bankState(
            accounts({
                status: 'blocked',
                reason: { code: 'email_required', userMessage: '' },
                blockingActions: ['provide-email'],
                resolved: verdictOf('fixable', 'email_required', email, 'provide-email'),
            }),
            [email]
        )
        expect(row.state).toBe('setting-up')
    })

    it('a step on one account outranks a refusal on the other', () => {
        const row = bankState(
            [
                ach({
                    status: 'blocked',
                    reason: { code: 'requirements_missing', userMessage: '' },
                    blockingActions: ['supplement:bridge'],
                    resolved: verdictOf('fixable', 'requirements_missing', supplement, 'document-resubmit'),
                }),
                sepa({
                    status: 'blocked',
                    reason: { code: 'bridge_terminal_rejection', userMessage: '' },
                    blockingActions: ['contact-support'],
                    resolved: verdictOf('blocked', 'bridge_terminal_rejection', support, 'contact-support'),
                }),
            ],
            [supplement, support]
        )
        expect(row.state).toBe('document-needed')
    })

    it('reads a rail with no verdict of its own the same way (an API before `resolved`)', () => {
        const row = bankState(
            accounts({
                status: 'blocked',
                reason: { code: 'requirements_uncollectable', userMessage: '' },
                blockingActions: ['contact-support'],
            }),
            [support]
        )
        expect(row).toEqual({
            key: 'bank',
            state: 'not-available',
            reason: 'requirements_uncollectable',
            support: true,
        })
    })

    describe('the card', () => {
        const cardState = (rails: RailCapability[], nextActions: NextAction[] = []) =>
            verified(capabilities(rails, nextActions), ONLY('card'))[0]

        it('an application under review reads setting up, a card still being issued too', () => {
            expect(cardState([card({ status: 'pending', operations: { pay: 'blocked' } })]).state).toBe('setting-up')
            expect(
                cardState([
                    card({ status: 'enabled', operations: { pay: 'blocked' }, resolved: { status: 'enabled' } }),
                ]).state
            ).toBe('setting-up')
        })

        it('proof_of_address_review: Under review', () => {
            const wait: NextAction = { key: 'wait:rain-poa-review', kind: 'wait', purpose: 'rain-poa-review' }
            const row = cardState(
                [
                    card({
                        status: 'requires-info',
                        operations: { pay: 'blocked' },
                        reason: { code: 'proof_of_address_review', userMessage: '' },
                        blockingActions: [wait.key],
                        resolved: { status: 'pending', nextAction: wait },
                    }),
                ],
                [wait]
            )
            expect(row).toEqual({ key: 'card', state: 'under-review', reason: 'proof_of_address_review' })
        })

        it('document_rejected on the card portal: Document needed, the card page owns the upload', () => {
            const portal: NextAction = { key: 'rain-hosted', kind: 'rain-hosted', purpose: 'rain-card' }
            const row = cardState(
                [
                    card({
                        status: 'requires-info',
                        operations: { pay: 'blocked' },
                        reason: { code: 'document_rejected', userMessage: '' },
                        blockingActions: ['rain-hosted'],
                        resolved: verdictOf('fixable', 'document_rejected', portal, 'document-resubmit'),
                    }),
                ],
                [portal]
            )
            expect(row.state).toBe('document-needed')
            expect(row.step?.provider).toBe('rain')
        })

        it.each(['region_block', 'compliance_block', 'card_rejected'])('%s: Not available, with support', (code) => {
            const row = cardState(
                [
                    card({
                        status: 'blocked',
                        operations: { pay: 'blocked' },
                        reason: { code, userMessage: '' },
                        blockingActions: ['contact-support'],
                        resolved: verdictOf('blocked', code, support, 'contact-support'),
                    }),
                ],
                [support]
            )
            expect(row).toEqual({ key: 'card', state: 'not-available', reason: code, support: true })
        })
    })
})
