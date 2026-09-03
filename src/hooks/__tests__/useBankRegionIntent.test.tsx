/** @jest-environment jsdom */
import { renderHook } from '@testing-library/react'
import { useBankRegionIntent } from '@/hooks/useBankRegionIntent'

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

// Hermetic: the real sets hook fetches the server tier lists on first mount.
jest.mock('@/hooks/useResidenceRestrictionSets', () => {
    const actual = jest.requireActual('@/hooks/useResidenceRestrictionSets')
    return {
        ...actual,
        useResidenceRestrictionSets: () => actual.LOCAL_RESIDENCE_RESTRICTION_SETS,
    }
})

const intentFor = (regionPath: string) => renderHook(() => useBankRegionIntent()).result.current(regionPath)

describe('useBankRegionIntent', () => {
    beforeEach(() => {
        mockUser = null
        mockSetupState = { residenceCountry: '' }
    })

    it('leaves the destination in charge when no residence is known', () => {
        expect(intentFor('europe')).toBe('EU')
        expect(intentFor('north-america')).toBe('NA')
        expect(intentFor('latam')).toBe('LATAM')
        expect(intentFor('rest-of-the-world')).toBe('ROW')
    })

    it('keeps the destination intent for a residence banks do onboard', () => {
        mockUser = { residence: { declared: 'BR' } }
        // a Brazilian resident really does need the Bridge level for a SEPA
        // destination — the residence must not narrow it to LATAM
        expect(intentFor('europe')).toBe('EU')
        expect(intentFor('latam')).toBe('LATAM')
    })

    it.each([
        ['GB', 'the UK rule'],
        ['RU', 'a sanctioned residence'],
        ['JP', 'a Bridge banking exclusion'],
    ])('forces ROW for %s (%s), whatever the destination', (iso2) => {
        mockUser = { residence: { declared: iso2 } }
        expect(intentFor('europe')).toBe('ROW')
        expect(intentFor('north-america')).toBe('ROW')
        expect(intentFor('latam')).toBe('ROW')
    })

    it('ignores a card-only restriction — bank rails still work there', () => {
        mockUser = { residence: { declared: 'IN' } }
        expect(intentFor('europe')).toBe('EU')
    })

    it('keeps the destination intent when a second residence is unrestricted', () => {
        // dual resident: the bank level is still winnable under BR, so the
        // offer stands (mirrors the intersection in useResidenceRestrictions)
        mockUser = { residence: { declared: 'GB', declaredSecond: 'BR' } }
        expect(intentFor('europe')).toBe('EU')
    })

    it('honours the server answer over the local declaration', () => {
        mockUser = { residenceRestrictions: { banking: true, card: false }, residence: { declared: 'BR' } }
        expect(intentFor('europe')).toBe('ROW')
    })
})
