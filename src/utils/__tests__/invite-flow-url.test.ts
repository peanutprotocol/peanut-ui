/** @jest-environment jsdom */
// inviteFlowUrl — the one route into the invite flow for guest CTAs. web goes
// to the /invite landing page; native (page pruned from the export) goes
// straight to signup. Pure URL builder: the invite itself is stashed by the
// caller via stashInvite with its TRUE type — the old native-side code-only
// cookie write here could leave a stale inviteType behind (Chip review,
// PR #2949).

let mockIsCapacitor = false
jest.mock('@/utils/capacitor', () => ({
    isCapacitor: () => mockIsCapacitor,
}))

import { getFromCookie, inviteFlowUrl } from '@/utils/general.utils'

beforeEach(() => {
    mockIsCapacitor = false
    document.cookie = 'inviteCode=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
})

describe('inviteFlowUrl', () => {
    it('web routes to the invite landing page and writes no cookie', () => {
        expect(inviteFlowUrl('alice', '%2Fclaim%2FX')).toBe('/invite?code=alice&redirect_uri=%2Fclaim%2FX')
        expect(getFromCookie('inviteCode')).toBeFalsy()
    })

    it('native goes straight to signup and writes no cookie either — stashing is the caller`s job', () => {
        mockIsCapacitor = true
        expect(inviteFlowUrl('alice', '%2Fclaim%2FX')).toBe('/setup?step=signup&redirect_uri=%2Fclaim%2FX')
        expect(getFromCookie('inviteCode')).toBeFalsy()
    })
})
