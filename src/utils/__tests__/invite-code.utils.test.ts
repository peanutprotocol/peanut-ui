// inviteCodeFromParams — the one reader for the inviter param. New links emit
// `invited_by`; every previously shared link carries `code`, which stays
// supported forever as an alias.

import { inviteCodeFromParams } from '@/utils/invite-code.utils'

describe('inviteCodeFromParams', () => {
    it('reads the invited_by param new links emit', () => {
        expect(inviteCodeFromParams(new URLSearchParams('invited_by=alice'))).toBe('alice')
    })

    it('reads the legacy code alias', () => {
        expect(inviteCodeFromParams(new URLSearchParams('code=alice'))).toBe('alice')
    })

    it('lets legacy code win when both are present — an existing link keeps its behavior', () => {
        expect(inviteCodeFromParams(new URLSearchParams('code=offramp&invited_by=alice'))).toBe('offramp')
    })

    it('returns null when neither is present', () => {
        expect(inviteCodeFromParams(new URLSearchParams('redirect_uri=%2Fhome'))).toBeNull()
    })
})
