import { renderHook } from '@testing-library/react'
import { useAuth } from '@/context/authContext'
import { type UserCapabilities } from '@/types/capabilities'
import { useCapabilities } from './useCapabilities'

jest.mock('@/context/authContext', () => ({
    useAuth: jest.fn(),
}))

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>

// Fixture covering every status + the Manteca operations refinement + a
// restriction + blockingActions, plus an orphan nextAction.
const FIXTURE: UserCapabilities = {
    rails: [
        // enabled Bridge rail, no operations split
        {
            id: 'bridge.ach_us',
            provider: 'bridge',
            method: 'ACH_US',

            channel: 'bank',
            country: 'US',
            currency: 'USD',
            status: 'enabled',
        },
        // Bridge rail needing info — two blocking actions
        {
            id: 'bridge.sepa_eu',
            provider: 'bridge',
            method: 'SEPA_EU',

            channel: 'bank',
            country: 'EU',
            currency: 'EUR',
            status: 'requires-info',
            blockingActions: ['accept-bridge-tos', 'sumsub-eea-uplift'],
            reason: { code: 'tos_required', userMessage: 'Accept the Bridge terms to continue.' },
        },
        // Manteca pool-tier BR rail — matches the BE resolver exactly: the rail is
        // ENABLED (usable, for `pay` via the corporate pool), and `operations`
        // refines deposit/withdraw to requires-info (need the full account). The
        // upgrade action lives in blockingActions. No top-level `reason` — the BE
        // only sets reason on requires-info/blocked rails, never an enabled one.
        {
            id: 'manteca.pix_br',
            provider: 'manteca',
            method: 'PIX_BR',

            channel: 'bank',
            country: 'BR',
            currency: 'BRL',
            status: 'enabled',
            operations: { pay: 'enabled', deposit: 'requires-info', withdraw: 'requires-info' },
            blockingActions: ['manteca-full-account'],
        },
        // Rain card provisioning — drives isKycInProgress + polling
        {
            id: 'rain.card',
            provider: 'rain',
            method: 'CARD',

            channel: 'card',
            country: 'GLOBAL',
            currency: 'USD',
            status: 'pending',
        },
        // Blocked Manteca AR rail covered by a restriction
        {
            id: 'manteca.mercadopago_qr_ar',
            provider: 'manteca',
            method: 'MERCADOPAGO_QR_AR',

            channel: 'qr-only',
            country: 'AR',
            currency: 'ARS',
            status: 'blocked',
            reason: { code: 'manteca_us_nationality', userMessage: 'US nationals cannot use this rail.' },
        },
    ],
    nextActions: [
        {
            key: 'accept-bridge-tos',
            kind: 'accept-tos',
            purpose: 'unlock-bridge-sepa',
            tosUrl: 'https://bridge.test/tos',
        },
        {
            key: 'sumsub-eea-uplift',
            kind: 'sumsub',
            purpose: 'unlock-bridge-sepa',
            levelKey: 'provider-rfi-eea-uplift',
        },
        {
            key: 'manteca-full-account',
            kind: 'sumsub',
            purpose: 'manteca-full-account',
            levelKey: 'manteca-requirements',
        },
        // orphan action not referenced by any rail
        { key: 'wait-rain', kind: 'wait', purpose: 'rain-card' },
    ],
    restrictions: [
        {
            code: 'manteca_us_nationality',
            affectedRailIds: ['manteca.mercadopago_qr_ar'],
            userMessage: 'US nationals cannot use Argentine rails.',
        },
    ],
}

function mockAuth(capabilities: UserCapabilities | undefined, overrides: Partial<ReturnType<typeof useAuth>> = {}) {
    mockUseAuth.mockReturnValue({
        isFetchingUser: false,
        fetchUser: jest.fn().mockResolvedValue(null),
        user: capabilities === undefined ? null : ({ capabilities } as unknown as ReturnType<typeof useAuth>['user']),
        ...overrides,
    } as unknown as ReturnType<typeof useAuth>)
}

describe('useCapabilities', () => {
    afterEach(() => jest.resetAllMocks())

    describe('passthrough + loading', () => {
        it('exposes rails / nextActions / restrictions from the user object', () => {
            mockAuth(FIXTURE)
            const { result } = renderHook(() => useCapabilities())
            expect(result.current.rails).toHaveLength(5)
            expect(result.current.nextActions).toHaveLength(4)
            expect(result.current.restrictions).toHaveLength(1)
        })

        it('falls back to an empty capability shape when the user is null', () => {
            mockAuth(undefined)
            const { result } = renderHook(() => useCapabilities())
            expect(result.current.rails).toEqual([])
            expect(result.current.nextActions).toEqual([])
            expect(result.current.restrictions).toEqual([])
            expect(result.current.isKycApproved).toBe(false)
            expect(result.current.isKycInProgress).toBe(false)
        })

        it('falls back to empty when capabilities is absent on the user', () => {
            mockUseAuth.mockReturnValue({
                isFetchingUser: false,
                fetchUser: jest.fn(),
                user: { user: { userId: 'u1' } },
            } as unknown as ReturnType<typeof useAuth>)
            const { result } = renderHook(() => useCapabilities())
            expect(result.current.rails).toEqual([])
        })

        it('reflects isFetchingUser as isLoading', () => {
            mockAuth(undefined, { isFetchingUser: true })
            const { result } = renderHook(() => useCapabilities())
            expect(result.current.isLoading).toBe(true)
        })
    })

    describe('getRail', () => {
        it('returns the matching rail', () => {
            mockAuth(FIXTURE)
            const { result } = renderHook(() => useCapabilities())
            expect(result.current.getRail('bridge.ach_us')?.method).toBe('ACH_US')
        })

        it('returns undefined for an unknown rail', () => {
            mockAuth(FIXTURE)
            const { result } = renderHook(() => useCapabilities())
            expect(result.current.getRail('bridge.nope')).toBeUndefined()
        })
    })

    describe('railsForProvider', () => {
        it('filters rails by provider', () => {
            mockAuth(FIXTURE)
            const { result } = renderHook(() => useCapabilities())
            expect(result.current.railsForProvider('manteca').map((r) => r.id)).toEqual([
                'manteca.pix_br',
                'manteca.mercadopago_qr_ar',
            ])
            expect(result.current.railsForProvider('bridge')).toHaveLength(2)
            expect(result.current.railsForProvider('rain')).toHaveLength(1)
        })
    })

    describe('hasEnabledRail', () => {
        it('is true when any rail is enabled (unscoped)', () => {
            mockAuth(FIXTURE)
            const { result } = renderHook(() => useCapabilities())
            expect(result.current.hasEnabledRail()).toBe(true)
        })

        it('is true for a provider that has an enabled rail', () => {
            mockAuth(FIXTURE)
            const { result } = renderHook(() => useCapabilities())
            expect(result.current.hasEnabledRail('bridge')).toBe(true)
        })

        it('is true for manteca whose pool rail is enabled (pay-capable, even though deposit/withdraw are gated)', () => {
            mockAuth(FIXTURE)
            const { result } = renderHook(() => useCapabilities())
            // manteca.pix_br is ENABLED (usable for pay via the pool). hasEnabledRail
            // is rail-level: an enabled rail counts even if some operations are gated.
            // Consumers needing a specific op must use canDo(op) — see the canDo tests.
            expect(result.current.hasEnabledRail('manteca')).toBe(true)
        })

        it('is false for a provider with no rails at all (rain)', () => {
            mockAuth(FIXTURE)
            const { result } = renderHook(() => useCapabilities())
            expect(result.current.hasEnabledRail('rain')).toBe(false)
        })
    })

    describe('operationStatus', () => {
        it('falls back to rail.status when no operations refinement', () => {
            mockAuth(FIXTURE)
            const { result } = renderHook(() => useCapabilities())
            expect(result.current.operationStatus('bridge.ach_us', 'deposit')).toBe('enabled')
            expect(result.current.operationStatus('bridge.sepa_eu', 'withdraw')).toBe('requires-info')
        })

        it('reads the per-operation refinement when present', () => {
            mockAuth(FIXTURE)
            const { result } = renderHook(() => useCapabilities())
            expect(result.current.operationStatus('manteca.pix_br', 'pay')).toBe('enabled')
            expect(result.current.operationStatus('manteca.pix_br', 'deposit')).toBe('requires-info')
            expect(result.current.operationStatus('manteca.pix_br', 'withdraw')).toBe('requires-info')
        })

        it('returns undefined for an unknown rail', () => {
            mockAuth(FIXTURE)
            const { result } = renderHook(() => useCapabilities())
            expect(result.current.operationStatus('manteca.unknown', 'pay')).toBeUndefined()
        })
    })

    describe('canDo (operations refinement)', () => {
        it('Manteca pool pix_br: canDo pay = true, canDo withdraw = false', () => {
            mockAuth(FIXTURE)
            const { result } = renderHook(() => useCapabilities())
            expect(result.current.canDo('pay', { railId: 'manteca.pix_br' })).toBe(true)
            expect(result.current.canDo('withdraw', { railId: 'manteca.pix_br' })).toBe(false)
            expect(result.current.canDo('deposit', { railId: 'manteca.pix_br' })).toBe(false)
        })

        it('provider-scoped: manteca can pay (via pix_br) but cannot withdraw', () => {
            mockAuth(FIXTURE)
            const { result } = renderHook(() => useCapabilities())
            expect(result.current.canDo('pay', { provider: 'manteca' })).toBe(true)
            expect(result.current.canDo('withdraw', { provider: 'manteca' })).toBe(false)
        })

        it('unscoped: deposit/withdraw true because Bridge ach_us is enabled', () => {
            mockAuth(FIXTURE)
            const { result } = renderHook(() => useCapabilities())
            expect(result.current.canDo('deposit')).toBe(true)
            expect(result.current.canDo('withdraw')).toBe(true)
        })

        it('returns false for an unknown railId', () => {
            mockAuth(FIXTURE)
            const { result } = renderHook(() => useCapabilities())
            expect(result.current.canDo('pay', { railId: 'manteca.unknown' })).toBe(false)
        })

        it('provider scope excludes other providers even when they are enabled', () => {
            mockAuth(FIXTURE)
            const { result } = renderHook(() => useCapabilities())
            // rain has only a pending rail → cannot do anything
            expect(result.current.canDo('pay', { provider: 'rain' })).toBe(false)
        })
    })

    describe('getNextAction', () => {
        it('returns the matching action descriptor', () => {
            mockAuth(FIXTURE)
            const { result } = renderHook(() => useCapabilities())
            expect(result.current.getNextAction('sumsub-eea-uplift')?.levelKey).toBe('provider-rfi-eea-uplift')
        })

        it('returns undefined for an unknown key', () => {
            mockAuth(FIXTURE)
            const { result } = renderHook(() => useCapabilities())
            expect(result.current.getNextAction('does-not-exist')).toBeUndefined()
        })
    })

    describe('nextActionsForRail', () => {
        it('resolves a rail blockingActions into action descriptors (order preserved)', () => {
            mockAuth(FIXTURE)
            const { result } = renderHook(() => useCapabilities())
            const actions = result.current.nextActionsForRail('bridge.sepa_eu')
            expect(actions.map((a) => a.key)).toEqual(['accept-bridge-tos', 'sumsub-eea-uplift'])
            expect(actions[0].kind).toBe('accept-tos')
        })

        it('returns [] for a rail with no blockingActions', () => {
            mockAuth(FIXTURE)
            const { result } = renderHook(() => useCapabilities())
            expect(result.current.nextActionsForRail('bridge.ach_us')).toEqual([])
        })

        it('returns [] for an unknown rail', () => {
            mockAuth(FIXTURE)
            const { result } = renderHook(() => useCapabilities())
            expect(result.current.nextActionsForRail('bridge.nope')).toEqual([])
        })
    })

    describe('restrictionForRail', () => {
        it('finds the restriction whose affectedRailIds includes the rail', () => {
            mockAuth(FIXTURE)
            const { result } = renderHook(() => useCapabilities())
            expect(result.current.restrictionForRail('manteca.mercadopago_qr_ar')?.code).toBe('manteca_us_nationality')
        })

        it('returns undefined for an unrestricted rail', () => {
            mockAuth(FIXTURE)
            const { result } = renderHook(() => useCapabilities())
            expect(result.current.restrictionForRail('bridge.ach_us')).toBeUndefined()
        })
    })

    describe('isKycApproved / isKycInProgress', () => {
        it('isKycApproved is true when at least one rail is enabled', () => {
            mockAuth(FIXTURE)
            const { result } = renderHook(() => useCapabilities())
            expect(result.current.isKycApproved).toBe(true)
        })

        it('isKycInProgress is true when a rail is pending or requires-info', () => {
            mockAuth(FIXTURE)
            const { result } = renderHook(() => useCapabilities())
            expect(result.current.isKycInProgress).toBe(true)
        })

        it('isKycInProgress is false when every rail is enabled or blocked', () => {
            mockAuth({
                rails: [
                    {
                        id: 'bridge.ach_us',
                        provider: 'bridge',
                        method: 'ACH_US',

                        channel: 'bank',
                        country: 'US',
                        currency: 'USD',
                        status: 'enabled',
                    },
                    {
                        id: 'manteca.mercadopago_qr_ar',
                        provider: 'manteca',
                        method: 'MERCADOPAGO_QR_AR',

                        channel: 'qr-only',
                        country: 'AR',
                        currency: 'ARS',
                        status: 'blocked',
                    },
                ],
                nextActions: [],
                restrictions: [],
            })
            const { result } = renderHook(() => useCapabilities())
            expect(result.current.isKycInProgress).toBe(false)
            expect(result.current.isKycApproved).toBe(true)
        })

        it('isKycApproved is false when no rail is enabled', () => {
            mockAuth({
                rails: [
                    {
                        id: 'rain.card',
                        provider: 'rain',
                        method: 'CARD',

                        channel: 'card',
                        country: 'GLOBAL',
                        currency: 'USD',
                        status: 'pending',
                    },
                ],
                nextActions: [],
                restrictions: [],
            })
            const { result } = renderHook(() => useCapabilities())
            expect(result.current.isKycApproved).toBe(false)
            expect(result.current.isKycInProgress).toBe(true)
        })
    })

    // D4 polling was moved to useUserAutoRefresh (mounted singleton from
    // AuthProvider) — useCapabilities no longer owns the timer. The polling
    // contract is tested colocated with the new hook: see
    // src/hooks/__tests__/useUserAutoRefresh.test.ts.
})
