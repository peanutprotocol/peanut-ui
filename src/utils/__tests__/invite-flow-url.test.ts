/** @jest-environment jsdom */
// inviteFlowUrl — the one route into the invite flow for guest CTAs. web goes
// to the /invite landing page; native (page pruned from the export) writes the
// session invite cookie and goes straight to signup.

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

    it('native writes the session cookie and goes straight to signup', () => {
        mockIsCapacitor = true
        expect(inviteFlowUrl('alice', '%2Fclaim%2FX')).toBe('/setup?step=signup&redirect_uri=%2Fclaim%2FX')
        expect(getFromCookie('inviteCode')).toBe('alice')
    })
})
