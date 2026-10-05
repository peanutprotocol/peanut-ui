import { deriveProviderRejection, identityDocumentRestartAction } from './provider-rejection.utils'
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

describe('deriveProviderRejection — actionKey (per-requirement Sumsub level)', () => {
    const sofAction: NextAction = {
        key: 'sumsub:source_of_funds',
        kind: 'sumsub',
        purpose: 'unlock-manteca',
        levelKey: 'source_of_funds',
    }

    test('fixable verdict with a sumsub nextAction exposes its key', () => {
        const info = deriveProviderRejection(
            [
                mantecaRail({
                    status: 'requires-info',
                    reason: { code: 'source_of_funds', userMessage: 'We need information about your source of funds.' },
                    resolved: {
                        status: 'fixable',
                        blocking: {
                            code: 'source_of_funds',
                            userMessage: 'We need information about your source of funds.',
                            selfHealable: true,
                            selfHealKind: 'document-resubmit',
                        },
                        nextAction: sofAction,
                    },
                }),
            ],
            'MANTECA'
        )
        expect(info.state).toBe('fixable')
        expect(info.reasonCode).toBe('source_of_funds')
        expect(info.actionKey).toBe('sumsub:source_of_funds')
    })

    test('action-less fixable verdict (generic document re-upload) has no actionKey', () => {
        const info = deriveProviderRejection(
            [
                mantecaRail({
                    status: 'requires-info',
                    resolved: {
                        status: 'fixable',
                        blocking: {
                            code: 'document_rejected',
                            userMessage: 'blurry',
                            selfHealable: true,
                            selfHealKind: 'document-resubmit',
                        },
                    },
                }),
            ],
            'MANTECA'
        )
        expect(info.state).toBe('fixable')
        expect(info.actionKey).toBeNull()
    })

    test('non-sumsub nextAction kinds never surface as an actionKey', () => {
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
                        nextAction: { key: 'restart-identity', kind: 'restart-identity', purpose: 'restart' },
                    },
                }),
            ],
            'MANTECA'
        )
        expect(info.state).toBe('restart-identity')
        expect(info.actionKey).toBeNull()
    })

    test('legacy (no resolved) fixable rail resolves the key from the passed nextActions', () => {
        const info = deriveProviderRejection(
            [mantecaRail({ status: 'requires-info', blockingActions: [sofAction.key] })],
            'MANTECA',
            [sofAction]
        )
        expect(info.state).toBe('fixable')
        expect(info.actionKey).toBe('sumsub:source_of_funds')
    })
})

// api#1776: an approval with no identity document on file. The API sends one
// top-level restart action and leaves every rail as it was, so a pool rail
// still pays. The verify buttons must start the identity check, never Manteca
// onboarding.
describe('deriveProviderRejection — approval with no identity document', () => {
    const documentRestart: NextAction = {
        key: 'restart-identity',
        kind: 'restart-identity',
        purpose: 'identity_document_missing',
    }
    const poolRail = mantecaRail({
        operations: { pay: 'enabled', deposit: 'requires-info', withdraw: 'requires-info' },
    })

    test('the top-level action makes an untouched pool rail a restart, with its own reason code', () => {
        expect(deriveProviderRejection([poolRail], 'MANTECA', [documentRestart])).toEqual({
            provider: 'MANTECA',
            state: 'restart-identity',
            // the copy comes from the reason code's catalog entry, not from prose
            userMessage: null,
            reasonCode: 'identity_document_missing',
            actionKey: null,
        })
    })

    test('it wins whatever the rails say', () => {
        const fixable = mantecaRail({
            status: 'requires-info',
            reason: { code: 'source_of_funds', userMessage: 'We need information about your source of funds.' },
        })
        const blocked = mantecaRail({ status: 'blocked', reason: { code: 'verification_blocked', userMessage: 'x' } })
        for (const rails of [[fixable], [blocked], []]) {
            const info = deriveProviderRejection(rails, 'MANTECA', [documentRestart])
            expect(info.state).toBe('restart-identity')
            expect(info.reasonCode).toBe('identity_document_missing')
        }
    })

    test('the identity is user-wide, so the Bridge rows restart too', () => {
        expect(deriveProviderRejection([], 'BRIDGE', [documentRestart]).state).toBe('restart-identity')
    })

    test('without the action the rails decide as before', () => {
        expect(deriveProviderRejection([poolRail], 'MANTECA', []).state).toBe('happy')
        expect(deriveProviderRejection([poolRail], 'MANTECA').state).toBe('happy')
    })

    test('a rail-level restart keeps its own path and reason code', () => {
        const info = deriveProviderRejection(
            [
                mantecaRail({
                    status: 'blocked',
                    blockingActions: ['restart-identity'],
                    reason: { code: 'country_not_supported', userMessage: 'try another document' },
                }),
            ],
            'MANTECA',
            [{ key: 'restart-identity', kind: 'restart-identity', purpose: 'restart' }]
        )
        expect(info.state).toBe('restart-identity')
        expect(info.reasonCode).toBe('country_not_supported')
        expect(info.userMessage).toBe('try another document')
    })
})

describe('identityDocumentRestartAction', () => {
    const documentRestart: NextAction = {
        key: 'restart-identity',
        kind: 'restart-identity',
        purpose: 'identity_document_missing',
    }

    test('finds the restart by its purpose', () => {
        const wait: NextAction = { key: 'wait:bridge', kind: 'wait', purpose: 'review' }
        expect(identityDocumentRestartAction([wait, documentRestart])).toBe(documentRestart)
    })

    test('ignores a restart for another cause and another kind with the same purpose', () => {
        expect(
            identityDocumentRestartAction([
                { key: 'restart-identity', kind: 'restart-identity', purpose: 'restart' },
                { key: 'sumsub:x', kind: 'sumsub', purpose: 'identity_document_missing' },
            ])
        ).toBeUndefined()
        expect(identityDocumentRestartAction([])).toBeUndefined()
    })
})
