/** @jest-environment jsdom */
import { renderHook } from '@testing-library/react'
import { deriveResidenceRestrictions, useResidenceRestrictions } from '@/hooks/useResidenceRestrictions'

let mockUser: {
    residenceRestrictions?: { banking: boolean; card: boolean }
    residence?: { declared?: string | null; declaredSecond?: string | null }
    user?: { userId: string }
} | null = null
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

    // A dual resident can verify under either jurisdiction, so an unrestricted
    // second country lifts the primary's restriction. That intersection used to
    // read the device mirror only, so a fresh device — where there is no mirror
    // — kept offers hidden from someone entitled to them.
    it("intersects with the server's second residence on a device with no mirror", () => {
        window.localStorage.clear()
        mockUser = {
            residenceRestrictions: { banking: true, card: true },
            residence: { declared: 'RU', declaredSecond: 'BR' },
            user: { userId: 'u1' },
        }
        const { result } = renderHook(() => useResidenceRestrictions())
        expect(result.current).toEqual({ banking: false, card: false })
    })

    it('treats an explicit null second residence as none, ignoring a stale mirror', () => {
        window.localStorage.setItem('peanut:secondResidence:u1', 'BR')
        mockUser = {
            residenceRestrictions: { banking: true, card: true },
            residence: { declared: 'RU', declaredSecond: null },
            user: { userId: 'u1' },
        }
        const { result } = renderHook(() => useResidenceRestrictions())
        expect(result.current).toEqual({ banking: true, card: true })
    })

    it('defaults to no restriction when nothing is known', () => {
        const { result } = renderHook(() => useResidenceRestrictions())
        expect(result.current).toEqual({ banking: false, card: false })
    })
})
