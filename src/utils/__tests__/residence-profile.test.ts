import { normalizeResidence, normalizeUserProfile, pendingResidenceCountry } from '../residence-profile'
import type { UserProfileWire } from '../residence-profile'

test('a pending replacement keeps the verified country active and preserves the true second jurisdiction', () => {
    const residence = normalizeResidence({
        verified: 'PT',
        declared: 'PT',
        pending: 'ES',
        pendingStatus: 'REVIEW_PENDING',
        pendingSecond: null,
        declaredSecond: 'BR',
    })
    expect(residence).toEqual({
        verified: { country: 'PT', status: 'CHANGE_REQUESTED', updatedAt: null },
        declared: { country: 'ES', status: 'REVIEW_PENDING', updatedAt: null, secondCountry: null },
        secondaryDeclaredCountry: 'BR',
    })
    expect(pendingResidenceCountry(residence)).toBe('ES')
})
test('a failed proposal preserves the verified residence without showing an active change', () => {
    const residence = normalizeResidence({ verified: 'PT', declared: 'PT', pending: 'ES', pendingStatus: 'REJECTED' })
    expect(residence?.verified?.status).toBe('VERIFIED')
    expect(residence?.declared?.status).toBe('REJECTED')
    expect(pendingResidenceCountry(residence)).toBeNull()
})
test('empty verified country falls back to declaration and an explicit absent second country clears stale mirrors', () => {
    expect(normalizeResidence({ verified: '', declared: 'ES', declaredSecond: null })).toEqual({
        verified: null,
        declared: { country: 'ES', status: 'UNVERIFIED', updatedAt: null, secondCountry: null },
        secondaryDeclaredCountry: null,
    })
    expect(
        normalizeResidence({ verified: null, declared: null, declaredSecond: null })?.secondaryDeclaredCountry
    ).toBeNull()
})
test('the compact model passes through unchanged and no legacy fields reach consumers', () => {
    const compact = {
        verified: { country: 'PT', status: 'VERIFIED' as const, updatedAt: null },
        declared: null,
        secondaryDeclaredCountry: null,
    }
    expect(normalizeResidence(compact)).toBe(compact)
    const profile = normalizeUserProfile({
        residence: { verified: 'PT', declared: 'PT', pending: null },
    } as UserProfileWire)
    expect(Object.keys(profile.residence!)).toEqual(['verified', 'declared'])
})
