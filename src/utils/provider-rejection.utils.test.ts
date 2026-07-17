import { deriveProviderRejection } from './provider-rejection.utils'
import type { NextAction, RailCapability } from '@/types/capabilities'

function mantecaRail(overrides: Partial<RailCapability> = {}): RailCapability {
    return {
        id: 'manteca.pix_br',
        provider: 'manteca',
        method: 'PIX_BR',
        channel: 'bank',
        country: 'BR',
        currency: 'BRL',
        status: 'enabled',
        ...overrides,
    }
}

describe('deriveProviderRejection — verdict-first classification', () => {
    test('all enabled → happy', () => {
        expect(deriveProviderRejection([mantecaRail()], 'MANTECA').state).toBe('happy')
    })

    test('other provider rails are ignored', () => {
        expect(deriveProviderRejection([mantecaRail({ status: 'blocked' })], 'BRIDGE').state).toBe('happy')
    })

    test('resolved fixable → fixable, verdict copy wins', () => {
        const info = deriveProviderRejection(
            [
                mantecaRail({
                    status: 'requires-info',
                    reason: { code: 'document_rejected', userMessage: 'legacy copy' },
                    resolved: {
                        status: 'fixable',
                        blocking: {
                            code: 'document_rejected',
                            userMessage: 'verdict copy',
                            selfHealable: true,
                            selfHealKind: 'document-resubmit',
                        },
                    },
                }),
            ],
            'MANTECA'
        )
        expect(info.state).toBe('fixable')
        expect(info.userMessage).toBe('verdict copy')
    })

    test('resolved blocked → blocked', () => {
        const info = deriveProviderRejection(
            [
                mantecaRail({
                    status: 'blocked',
                    resolved: {
                        status: 'blocked',
                        blocking: { code: 'verification_blocked', userMessage: 'terminal', selfHealable: false },
                    },
                }),
            ],
            'MANTECA'
        )
        expect(info.state).toBe('blocked')
        expect(info.userMessage).toBe('terminal')
    })

    test('provide-email verdict maps to blocked, never a document-upload fixable', () => {
        const info = deriveProviderRejection(
            [
                mantecaRail({
                    status: 'blocked',
                    resolved: {
                        status: 'fixable',
                        blocking: {
                            code: 'email_required',
                            userMessage: 'add an email',
                            selfHealable: true,
                            selfHealKind: 'provide-email',
                        },
                    },
                }),
            ],
            'MANTECA'
        )
        expect(info.state).toBe('blocked')
    })

    test('restart-identity selfHealKind on MANTECA → restart-identity', () => {
        const info = deriveProviderRejection(
            [
                mantecaRail({
                    status: 'blocked',
                    resolved: {
                        status: 'blocked',
                        blocking: {
                            code: 'country_not_supported',
                            userMessage: 'try another document',
                            selfHealable: true,
                            selfHealKind: 'restart-identity',
                        },
                    },
                }),
            ],
            'MANTECA'
        )
        expect(info.state).toBe('restart-identity')
    })

    test('legacy country_not_supported reason code still maps to restart-identity (no resolved)', () => {
        const info = deriveProviderRejection(
            [
                mantecaRail({
                    status: 'blocked',
                    reason: { code: 'country_not_supported', userMessage: 'try another document' },
                }),
            ],
            'MANTECA'
        )
        expect(info.state).toBe('restart-identity')
    })

    test('legacy requires-info → fixable; legacy blocked → blocked (status semantics preserved)', () => {
        expect(deriveProviderRejection([mantecaRail({ status: 'requires-info' })], 'MANTECA').state).toBe('fixable')
        expect(deriveProviderRejection([mantecaRail({ status: 'blocked' })], 'MANTECA').state).toBe('blocked')
    })

    test('wait-marked pending verdict → happy (nothing user-actionable, no dead-end CTA)', () => {
        const info = deriveProviderRejection(
            [
                mantecaRail({
                    status: 'requires-info',
                    resolved: {
                        status: 'pending',
                        nextAction: { key: 'wait:bridge', kind: 'wait', purpose: 'review' },
                    },
                }),
            ],
            'MANTECA'
        )
        expect(info.state).toBe('happy')
    })

    test('legacy wait-only rail → happy when nextActions are provided', () => {
        const wait: NextAction = { key: 'wait:bridge', kind: 'wait', purpose: 'review' }
        const info = deriveProviderRejection(
            [mantecaRail({ status: 'requires-info', blockingActions: [wait.key] })],
            'MANTECA',
            [wait]
        )
        expect(info.state).toBe('happy')
    })

    test('fixable outranks blocked across sibling rails (legacy priority)', () => {
        const info = deriveProviderRejection(
            [
                mantecaRail({ id: 'manteca.bank_ar', method: 'BANK_TRANSFER_AR', country: 'AR', status: 'blocked' }),
                mantecaRail({ status: 'requires-info', reason: { code: 'x', userMessage: 'fix me' } }),
            ],
            'MANTECA'
        )
        expect(info.state).toBe('fixable')
        expect(info.userMessage).toBe('fix me')
    })
})
