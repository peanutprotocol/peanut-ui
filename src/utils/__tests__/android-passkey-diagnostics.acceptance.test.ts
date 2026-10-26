import { sanitizePasskeyDiagnostics } from '@/utils/android-passkey-diagnostics'

describe('passkey diagnostic privacy boundary', () => {
    it('preserves the explicitly allowed, valid non-secret facts', () => {
        const facts = {
            androidSdk: 35,
            manufacturer: 'Samsung',
            model: 'SM-S9180',
            osVersion: '14.0',
            appVersion: '1.2.3 (42)',
            pluginVersion: '8.2.2',
            playServicesVersion: '24.12.16',
            playServicesStatus: 'available',
            nativeException: 'NoCredentialException',
            durationMs: 600000,
            operation: 'get',
            outcome: 'timeout',
        }
        expect(sanitizePasskeyDiagnostics(facts)).toEqual(facts)
    })

    it.each([null, undefined, true, 1, 'credential', [], [{ operation: 'get' }]])(
        'rejects non-record input %p',
        (input) => {
            expect(sanitizePasskeyDiagnostics(input)).toEqual({})
        }
    )

    it('drops secrets and nested/raw payloads without changing the caller input', () => {
        const input = Object.freeze({
            operation: 'get',
            outcome: 'error',
            requestId: 'secret-request',
            challenge: 'secret-challenge',
            token: 'secret-token',
            message: 'user@example.org',
            credential: { id: 'raw-credential' },
            error: { message: 'raw exception' },
            manufacturer: { name: 'Samsung' },
            model: ['SM-S9180'],
        })
        expect(sanitizePasskeyDiagnostics(input)).toEqual({ operation: 'get', outcome: 'error' })
        expect(input.requestId).toBe('secret-request')
    })

    it.each(['manufacturer', 'model', 'osVersion', 'appVersion', 'pluginVersion', 'playServicesVersion'])(
        'bounds and validates %s',
        (key) => {
            for (const value of [
                '',
                'x'.repeat(81),
                'user@example.org',
                'https://example.org',
                'a\nb',
                '中文',
                {},
                [],
                false,
                123,
            ]) {
                expect(sanitizePasskeyDiagnostics({ [key]: value })).toEqual({})
            }
            for (const value of ['A', 'x'.repeat(80), 'A-Z_a.0 (v2)+']) {
                expect(sanitizePasskeyDiagnostics({ [key]: value })).toEqual({ [key]: value })
            }
        }
    )

    it.each([-1, 0, 101, 1.1, Infinity, NaN, '35', null])('drops invalid androidSdk %p', (androidSdk) => {
        expect(sanitizePasskeyDiagnostics({ androidSdk })).toEqual({})
    })

    it.each([1, 100])('accepts androidSdk boundary %p', (androidSdk) => {
        expect(sanitizePasskeyDiagnostics({ androidSdk })).toEqual({ androidSdk })
    })

    it.each([-1, 600001, 0.5, Infinity, NaN, '10', null])('drops invalid durationMs %p', (durationMs) => {
        expect(sanitizePasskeyDiagnostics({ durationMs })).toEqual({})
    })

    it.each([0, 600000])('accepts durationMs boundary %p', (durationMs) => {
        expect(sanitizePasskeyDiagnostics({ durationMs })).toEqual({ durationMs })
    })

    it.each(['available', 'missing', 'disabled', 'outdated', 'invalid', 'unknown'])(
        'allows service status %s',
        (playServicesStatus) => {
            expect(sanitizePasskeyDiagnostics({ playServicesStatus })).toEqual({ playServicesStatus })
        }
    )

    it.each(['get', 'create'])('allows operation %s', (operation) => {
        expect(sanitizePasskeyDiagnostics({ operation })).toEqual({ operation })
    })

    it.each(['success', 'error', 'timeout'])('allows outcome %s', (outcome) => {
        expect(sanitizePasskeyDiagnostics({ outcome })).toEqual({ outcome })
    })

    it('rejects out-of-enum facts and non-simple native exception names', () => {
        expect(
            sanitizePasskeyDiagnostics({ playServicesStatus: 'AVAILABLE', operation: 'login', outcome: 'cancelled' })
        ).toEqual({})
        for (const nativeException of [
            '',
            'a'.repeat(81),
            'android.NoCredentialException',
            'Error: token',
            'Error42',
            'A_B',
            {},
            [],
        ]) {
            expect(sanitizePasskeyDiagnostics({ nativeException })).toEqual({})
        }
        expect(sanitizePasskeyDiagnostics({ nativeException: 'A'.repeat(80) })).toEqual({
            nativeException: 'A'.repeat(80),
        })
    })

    it('keeps only allowlisted scalar facts for a deterministic bounded adversarial input corpus', () => {
        // Fixed seed 0x1a2b3c4d; 128 objects, up to 12 untrusted keys each.
        let seed = 0x1a2b3c4d
        const random = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
            return seed
        }
        for (let iteration = 0; iteration < 128; iteration++) {
            const facts: Record<string, unknown> = { operation: 'get', durationMs: random() % 600001 }
            for (let field = 0; field < 12; field++) facts[`secret${random()}`] = { token: `private-${random()}` }
            expect(sanitizePasskeyDiagnostics(facts)).toEqual({ operation: 'get', durationMs: facts.durationMs })
        }
    })
})
