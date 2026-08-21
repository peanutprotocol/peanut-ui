/** @jest-environment jsdom */
import { renderHook } from '@testing-library/react'
import { deriveResidenceRestrictions, useResidenceRestrictions } from '@/hooks/useResidenceRestrictions'

let mockUser: { residenceRestrictions?: { banking: boolean; card: boolean } } | null = null
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: mockUser }),
}))

let mockSetupState: { residenceCountry: string }
jest.mock('@/redux/hooks', () => ({
    useSetupStore: () => mockSetupState,
}))

// Hermetic: the real sets hook fetches the server tier lists on first mount;
// return the bundled mirror so renderHook never triggers a network request.
jest.mock('@/hooks/useResidenceRestrictionSets', () => {
    const actual = jest.requireActual('@/hooks/useResidenceRestrictionSets')
    return {
        ...actual,
        useResidenceRestrictionSets: () => actual.LOCAL_RESIDENCE_RESTRICTION_SETS,
    }
})

describe('deriveResidenceRestrictions', () => {
    it.each([
        ['RU', { banking: true, card: true }],
        ['HK', { banking: true, card: true }],
        ['KP', { banking: true, card: true }],
        ['IN', { banking: false, card: true }],
        ['JP', { banking: true, card: false }],
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
    })

    it('prefers the server value when present', () => {
        mockUser = { residenceRestrictions: { banking: true, card: false } }
        mockSetupState = { residenceCountry: 'RU' } // stale local value must lose
        const { result } = renderHook(() => useResidenceRestrictions())
        expect(result.current).toEqual({ banking: true, card: false })
    })

    it('falls back to the declared setup residence pre-account', () => {
        mockSetupState = { residenceCountry: 'UA' }
        const { result } = renderHook(() => useResidenceRestrictions())
        expect(result.current).toEqual({ banking: false, card: true })
    })

    it('defaults to no restriction when nothing is known', () => {
        const { result } = renderHook(() => useResidenceRestrictions())
        expect(result.current).toEqual({ banking: false, card: false })
    })
})
