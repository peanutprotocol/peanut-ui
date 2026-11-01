/** @jest-environment jsdom */
import { normalizeResidence } from '@/utils/residence-profile'

import { renderHook } from '@testing-library/react'
import { deriveResidenceRestrictions, useResidenceRestrictions } from '@/hooks/useResidenceRestrictions'

let mockUser: {
    residenceRestrictions?: { banking: boolean; card: boolean }
    residence?: import('@/interfaces/interfaces').ResidenceProfile
    user?: { userId: string; bridgeCustomerId?: string | null }
} | null = null
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: mockUser }),
}))

let mockSetupState: { residenceCountry: string }
jest.mock('@/features/setup/SetupFlowContext', () => ({
    useOptionalSetupFlow: () => mockSetupState,
}))

// Hermetic: the real sets hook fetches the server tier lists on first mount;
// stand the bundled mirror in for them, loaded or not.
let mockSettled = true
jest.mock('@/hooks/useResidenceRestrictionSets', () => {
    const actual = jest.requireActual('@/hooks/useResidenceRestrictionSets')
    return {
        ...actual,
        useResidenceRestrictionSetsWithStatus: () => ({
            sets: actual.LOCAL_RESIDENCE_RESTRICTION_SETS,
            settled: mockSettled,
        }),
    }
})

describe('deriveResidenceRestrictions', () => {
    it.each([
        ['RU', { banking: true, card: true }],
        // Bridge- and Rain-prohibited, so both halves (api#1738)
        ['VE', { banking: true, card: true }],
        ['IQ', { banking: true, card: true }],
        // a document rule only, so in no tier (TASK-23054 R1)
        ['HK', { banking: false, card: false }],
        // Bridge-prohibited; the card still works
        ['AF', { banking: true, card: false }],
        // Bridge-prohibited and on Rain's Platform Standards list
        ['CD', { banking: true, card: true }],
        // Rain approves Peanut here first; banking still works
        ['NG', { banking: false, card: true }],
        ['KP', { banking: true, card: true }],
        ['IN', { banking: false, card: true }],
        ['JP', { banking: true, card: false }],
        // in Bridge's table, absent from its prose note — the table wins
        ['GW', { banking: true, card: false }],
        ['BR', { banking: false, card: false }],
        ['', { banking: false, card: false }],
    ])('%s → %j', (iso2, expected) => {
        expect(deriveResidenceRestrictions(iso2)).toEqual(expected)
    })
})

describe('useResidenceRestrictions', () => {
    beforeEach(() => {
        mockUser = null
        mockSetupState = { residenceCountry: '' }
        mockSettled = true
        window.localStorage.clear()
    })

    it('ignores the device mirror once the server answered with no residence', () => {
        window.localStorage.setItem('peanut:declaredResidence:u1', 'RU')
        mockUser = { user: { userId: 'u1' }, residence: normalizeResidence({ verified: null, declared: null }) }
        const { result } = renderHook(() => useResidenceRestrictions())
        expect(result.current).toEqual({ banking: false, card: false })
    })

    it('uses the device mirror only before the server answers', () => {
        window.localStorage.setItem('peanut:declaredResidence:u1', 'RU')
        mockUser = { user: { userId: 'u1' } }
        const { result } = renderHook(() => useResidenceRestrictions())
        expect(result.current).toEqual(deriveResidenceRestrictions('RU'))
    })

    it('prefers the server value when present', () => {
        mockUser = { residenceRestrictions: { banking: true, card: false } }
        mockSetupState = { residenceCountry: 'RU' } // stale local value must lose
        const { result } = renderHook(() => useResidenceRestrictions())
        expect(result.current).toEqual({ banking: true, card: false })
    })

    it('uses verified residence before a conflicting declaration when the server restriction summary is absent', () => {
        mockUser = {
            user: { userId: 'u1' },
            residence: normalizeResidence({
                verified: 'BR',
                declared: 'RU',
                pending: 'RU',
                pendingStatus: 'COLLECTING',
                declaredSecond: null,
            }),
        }
        const { result } = renderHook(() => useResidenceRestrictions())
        expect(result.current).toEqual({ banking: false, card: false })
    })

    it('falls back to the declared setup residence pre-account', () => {
        mockSetupState = { residenceCountry: 'UA' }
        const { result } = renderHook(() => useResidenceRestrictions())
        expect(result.current).toEqual({ banking: false, card: true })
    })

    // The API keys restrictions on one residence (get-user.ts: a second one "never narrows" them),
    // and only it knows exceptions like an existing Bridge customer in South Korea.
    it("uses the server's answer as is, whatever the second residence", () => {
        mockUser = {
            residenceRestrictions: { banking: true, card: true },
            residence: normalizeResidence({ declared: 'GB', declaredSecond: 'DE' }),
            user: { userId: 'u1' },
        }
        const { result } = renderHook(() => useResidenceRestrictions())
        expect(result.current).toEqual({ banking: true, card: true })
    })

    it('opens nothing before the server lists load, since the bundled mirror is incomplete', () => {
        mockSettled = false
        mockSetupState = { residenceCountry: 'KR' }
        const { result, rerender } = renderHook(() => useResidenceRestrictions())
        expect(result.current).toEqual({ banking: true, card: true })
        mockSettled = true
        rerender()
        expect(result.current).toEqual(expect.objectContaining({ card: false }))
    })

    it('still prefers the server value while the lists load', () => {
        mockSettled = false
        mockUser = { residenceRestrictions: { banking: false, card: false } }
        const { result } = renderHook(() => useResidenceRestrictions())
        expect(result.current).toEqual({ banking: false, card: false })
    })

    it('defaults to no restriction when nothing is known', () => {
        const { result } = renderHook(() => useResidenceRestrictions())
        expect(result.current).toEqual({ banking: false, card: false })
    })
})

it('preserves existing KR banking when the server summary is absent', () => {
    mockSettled = true
    mockUser = {
        user: { userId: 'u1', bridgeCustomerId: 'synthetic-bridge' },
        residence: normalizeResidence({ declared: 'KR' }),
    }
    const { result, rerender } = renderHook(() => useResidenceRestrictions())
    expect(result.current).toEqual({ banking: false, card: false })
    mockUser = { ...mockUser, user: { userId: 'u1' } }
    rerender()
    expect(result.current).toEqual({ banking: true, card: false })
})
