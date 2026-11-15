/** Frozen UI oracle. Implement the companion adapter using the REAL UI entry boundary.
 * Additive public correction: UI_ORACLE_CORRECTION_PUBLIC_PACKET.md; originals remain unchanged.
 */
import { describe, expect, jest, test } from '@jest/globals'
import {
    createVerificationOpeningHarness,
    createVerificationOpeningRequestHarness,
} from './verificationOpening.acceptance-adapter'
type Entry = {
    authenticated: boolean
    userId: string | null
    verificationId: string | null
    residenceCountry: string | null
    screen: 'verification-entry' | 'overview' | 'other' | 'legacy-sdk' | 'feature-questions' | 'sdk'
    entryScope?: string
    feature?: 'bank' | 'card' | 'local'
}
type Request = {
    method: string
    url: string
    body: unknown
    accountId: string
    headers: Record<string, string>
    signal: AbortSignal
}
const SCOPE_A = 'a'.repeat(64)
const SCOPE_B = 'b'.repeat(64)
const A: Entry = {
    entryScope: SCOPE_A,
    authenticated: true,
    userId: 'user-a',
    verificationId: 'identity-a',
    residenceCountry: 'AR',
    screen: 'verification-entry',
}
const deferred = () => {
    let resolve!: (r: { status: number }) => void
    const promise = new Promise<{ status: number }>((r) => {
        resolve = r
    })
    return { promise, resolve }
}
function fixture(response: Promise<{ status: number }> = Promise.resolve({ status: 204 })) {
    const request = jest.fn<(request: Request) => Promise<{ status: number }>>().mockImplementation(() => response)
    const harness = createVerificationOpeningHarness({ request })
    return { request, harness }
}
const opens = (request: ReturnType<typeof fixture>['request']) =>
    request.mock.calls.map(([r]) => r).filter((r) => r.method === 'POST' && r.url === '/users/kyc/opened')

describe('real authenticated verification entry', () => {
    test('display records explicit entry using only the allowed body fields', async () => {
        const { harness, request } = fixture()
        await harness.show(A)
        await harness.flush()
        expect(opens(request)).toHaveLength(1)
        expect(opens(request)[0].body ?? {}).toEqual({})
        expect(opens(request)[0].accountId).toBe('user-a')
        expect(opens(request)[0].headers['x-kyc-entry-user']).toBe('user-a')
        expect(opens(request)[0].headers['x-kyc-entry-scope']).toBe(SCOPE_A)
        expect(harness.verificationUsable()).toBe(true)
        await harness.dispose()
    })
    test.each(['bank', 'card', 'local'] as const)(
        'actual /verify?feature=%s surface never sends a base-opening POST',
        async (feature) => {
            const { harness, request } = fixture()
            await harness.show({ ...A, screen: 'feature-questions', feature })
            await harness.flush()
            expect(opens(request)).toEqual([])
            await harness.dispose()
        }
    )
    test.each([
        { ...A, authenticated: false, userId: null },
        { ...A, screen: 'overview' as const },
        { ...A, screen: 'other' as const },
        { ...A, screen: 'legacy-sdk' as const },
        { ...A, screen: 'sdk' as const },
        { ...A, screen: 'feature-questions' as const },
    ])('non-entry or unauthenticated context creates no task request: %j', async (context) => {
        const { harness, request } = fixture()
        await harness.show(context)
        await harness.flush()
        expect(opens(request)).toEqual([])
        await harness.dispose()
    })
    test.each(['questions', 'plan', 'prefetch', 'background-probe'] as const)(
        '%s reads create no opening obligation',
        async (source) => {
            const { harness, request } = fixture()
            await harness.backgroundRead(source, A)
            await harness.flush()
            expect(opens(request)).toEqual([])
            await harness.dispose()
        }
    )
    test('rerenders deduplicate an in-flight opening in the same scope', async () => {
        const pending = deferred()
        const { harness, request } = fixture(pending.promise)
        await harness.show(A)
        for (let i = 0; i < 8; i++) await harness.rerender({ ...A })
        await harness.flush()
        expect(opens(request)).toHaveLength(1)
        expect(harness.verificationUsable()).toBe(true)
        pending.resolve({ status: 204 })
        await harness.flush()
        await harness.dispose()
    })
    test.each([404, 409, 503])('endpoint %i leaves verification usable without an unhandled error', async (status) => {
        const { harness, request } = fixture(Promise.resolve({ status }))
        await harness.show(A)
        await harness.flush()
        expect(opens(request)).toHaveLength(1)
        expect(harness.verificationUsable()).toBe(true)
        expect(harness.unhandledErrors()).toEqual([])
        await harness.dispose()
    })
    test('network rejection is nonblocking', async () => {
        const { harness, request } = fixture()
        request.mockRejectedValueOnce(new Error('synthetic network failure'))
        await harness.show(A)
        await harness.flush()
        expect(harness.verificationUsable()).toBe(true)
        expect(harness.unhandledErrors()).toEqual([])
        await harness.dispose()
    })
    test('account switch cancels old work and cannot credit its delayed success to the new account', async () => {
        const pending = deferred()
        const { harness, request } = fixture()
        request.mockReturnValueOnce(pending.promise)
        await harness.show(A)
        await harness.flush()
        const original = opens(request)[0]
        const B: Entry = {
            ...A,
            userId: 'user-b',
            verificationId: 'identity-b',
            residenceCountry: 'BR',
            entryScope: SCOPE_B,
        }
        await harness.show(B)
        await harness.flush()
        expect(original.signal.aborted).toBe(true)
        pending.resolve({ status: 204 })
        await harness.flush()
        await harness.rerender(B)
        await harness.flush()
        expect(opens(request).map((r) => r.accountId)).toEqual(['user-a', 'user-b'])
        expect(opens(request).map((r) => [r.headers['x-kyc-entry-user'], r.headers['x-kyc-entry-scope']])).toEqual([
            ['user-a', SCOPE_A],
            ['user-b', SCOPE_B],
        ])
        for (const call of opens(request)) expect(call.body ?? {}).toEqual({})
        expect(harness.unhandledErrors()).toEqual([])
        expect(harness.verificationUsable()).toBe(true)
        await harness.dispose()
    })
    test('navigation away cancels pending entry and delayed completion creates no further task', async () => {
        const pending = deferred()
        const { harness, request } = fixture(pending.promise)
        await harness.show(A)
        await harness.flush()
        await harness.navigateAway()
        expect(opens(request)[0].signal.aborted).toBe(true)
        pending.resolve({ status: 204 })
        await harness.flush()
        expect(opens(request)).toHaveLength(1)
        expect(harness.unhandledErrors()).toEqual([])
        await harness.dispose()
    })
})

describe('public optional-feature request helper wire format, separate from rendered-route eligibility', () => {
    test.each(['bank', 'card', 'local'] as const)(
        'explicit %s helper argument sends only feature in the body',
        async (feature) => {
            const request = jest
                .fn<(request: Request) => Promise<{ status: number }>>()
                .mockResolvedValue({ status: 204 })
            const helper = createVerificationOpeningRequestHarness({ request, userId: 'user-a', entryScope: SCOPE_A })
            try {
                // Invokes the actual helper reused by the real hook; no fabricated feature-bearing base route.
                await helper.postOpeningRequest(feature)
                expect(opens(request)).toHaveLength(1)
                expect(opens(request)[0].body).toEqual({ feature })
                expect(Object.keys(opens(request)[0].body as object)).toEqual(['feature'])
                expect(opens(request)[0].accountId).toBe('user-a')
                expect(opens(request)[0].headers['x-kyc-entry-user']).toBe('user-a')
                expect(opens(request)[0].headers['x-kyc-entry-scope']).toBe(SCOPE_A)
            } finally {
                await helper.dispose()
            }
        }
    )
})

describe('displayed questions scope and rollout', () => {
    test('older questions API without scope remains usable and sends no unguarded POST', async () => {
        const { harness, request } = fixture()
        await harness.show({ ...A, entryScope: undefined })
        await harness.flush()
        expect(opens(request)).toEqual([])
        expect(harness.verificationUsable()).toBe(true)
        expect(harness.unhandledErrors()).toEqual([])
        await harness.dispose()
    })
    test('a newly displayed scoped response starts recording after an older unscoped view', async () => {
        const { harness, request } = fixture()
        await harness.show({ ...A, entryScope: undefined })
        await harness.flush()
        await harness.show(A)
        await harness.flush()
        expect(opens(request)).toHaveLength(1)
        expect(opens(request)[0].headers['x-kyc-entry-scope']).toBe(SCOPE_A)
        await harness.dispose()
    })
    test('409 does not silently replace the scope or fetch a scope solely to retry stale entry', async () => {
        const { harness, request } = fixture(Promise.resolve({ status: 409 }))
        await harness.show(A)
        await harness.flush()
        for (let i = 0; i < 3; i++) await harness.rerender({ ...A })
        await harness.flush()
        expect(opens(request)).toHaveLength(1)
        expect(request.mock.calls.filter(([r]) => r.method === 'GET')).toEqual([])
        await harness.show({ ...A, entryScope: SCOPE_B })
        await harness.flush()
        expect(opens(request).map((r) => r.headers['x-kyc-entry-scope'])).toEqual([SCOPE_A, SCOPE_B])
        expect(harness.verificationUsable()).toBe(true)
        await harness.dispose()
    })
    test('same-user scope replacement cancels old work without crediting its late success', async () => {
        const pending = deferred()
        const { harness, request } = fixture()
        request.mockReturnValueOnce(pending.promise)
        await harness.show(A)
        await harness.flush()
        const original = opens(request)[0]
        const replacement = { ...A, verificationId: 'identity-replaced', entryScope: SCOPE_B }
        await harness.show(replacement)
        await harness.flush()
        expect(original.signal.aborted).toBe(true)
        pending.resolve({ status: 204 })
        await harness.flush()
        await harness.rerender(replacement)
        await harness.flush()
        expect(opens(request).map((r) => r.headers['x-kyc-entry-scope'])).toEqual([SCOPE_A, SCOPE_B])
        expect(harness.unhandledErrors()).toEqual([])
        await harness.dispose()
    })
})
