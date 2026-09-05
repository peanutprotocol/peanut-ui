/**
 * The hook takes the server key as an ARGUMENT rather than reading it. There is
 * no single source to read: useHomeFlow takes the user from the redux store and
 * the profile surfaces take it from authContext. A first cut read authContext
 * internally and returned null on the home screen, where redux held the pick.
 */
import { act, renderHook } from '@testing-library/react'
import { resetLetterAvatarCache, storeLetterAvatar } from '../avatar-letter.storage'
import { useAvatarKey } from '../useAvatarKey'

beforeEach(() => {
    window.localStorage.clear()
    resetLetterAvatarCache()
})

describe('useAvatarKey', () => {
    it('returns whatever server key the caller passes, from whichever store it came', () => {
        expect(renderHook(() => useAvatarKey('basic.frog', 'u1')).result.current).toBe('basic.frog')
        expect(renderHook(() => useAvatarKey(null, 'u1')).result.current).toBeNull()
        expect(renderHook(() => useAvatarKey(undefined, undefined)).result.current).toBeNull()
    })

    it('prefers a device-local letter over the server pick it has not superseded yet', () => {
        storeLetterAvatar('u1', 'letter.k')

        expect(renderHook(() => useAvatarKey(null, 'u1')).result.current).toBe('letter.k')
        expect(renderHook(() => useAvatarKey('basic.frog', 'u1')).result.current).toBe('letter.k')
    })

    it('scopes the mirror per account — a second login does not inherit the first initial', () => {
        storeLetterAvatar('u1', 'letter.k')

        expect(renderHook(() => useAvatarKey(null, 'u2')).result.current).toBeNull()
    })

    it('re-renders live when the picker writes, so the header updates behind the drawer', () => {
        const { result } = renderHook(() => useAvatarKey(null, 'u1'))
        expect(result.current).toBeNull()

        act(() => storeLetterAvatar('u1', 'letter.m'))
        expect(result.current).toBe('letter.m')

        act(() => storeLetterAvatar('u1', null))
        expect(result.current).toBeNull()
    })

    it('ignores a mirror value that is not a single lowercase letter key', () => {
        window.localStorage.setItem('peanut:avatarLetter:u1', 'badge.FOUNDING_PIONEER.crown')
        resetLetterAvatarCache()

        expect(renderHook(() => useAvatarKey(null, 'u1')).result.current).toBeNull()
    })
})
