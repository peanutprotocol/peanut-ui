/** @jest-environment jsdom */
jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

// inviteFlowUrl — the one route into the invite flow for guest CTAs. web goes
// to the /invite landing page; native (page pruned from the export) goes
// straight to signup. Pure URL builder: the invite itself is stashed by the
// caller via stashInvite with its TRUE type — the old native-side code-only
// write here could leave a stale inviteType behind (Chip review, PR #2949).

let mockIsCapacitor = false
jest.mock('@/utils/capacitor', () => ({
    isCapacitor: () => mockIsCapacitor,
}))

import { generateInviteCodeLink, inviteFlowUrl } from '@/utils/general.utils'
import { readInviteCode } from '@/utils/invite-stash'
import { REFERRAL_SOURCES } from '@/constants/analytics.consts'

beforeEach(() => {
    mockIsCapacitor = false
    localStorage.clear()
})

describe('inviteFlowUrl', () => {
    it('web routes to the invite landing page and stashes nothing', () => {
        expect(inviteFlowUrl('alice', '%2Fclaim%2FX')).toBe('/invite?code=alice&redirect_uri=%2Fclaim%2FX')
        expect(readInviteCode()).toBe('')
    })

    it('native goes straight to signup and stashes nothing either — stashing is the caller`s job', () => {
        mockIsCapacitor = true
        expect(inviteFlowUrl('alice', '%2Fclaim%2FX')).toBe('/setup?step=signup&redirect_uri=%2Fclaim%2FX')
        expect(readInviteCode()).toBe('')
    })
})

describe('generateInviteCodeLink', () => {
    it('stays a plain invite link when no share source is given', () => {
        const { inviteLink, inviteCode } = generateInviteCodeLink('Alice')
        expect(inviteCode).toBe('alice')
        expect(inviteLink).toBe(`${window.location.origin}/invite?code=alice`)
    })

    it('keeps the code and tags the share source as utm_content (TASK-23382)', () => {
        const { inviteLink } = generateInviteCodeLink('Alice', REFERRAL_SOURCES.BADGE_UNLOCK)
        const url = new URL(inviteLink)
        expect(url.origin + url.pathname).toBe(`${window.location.origin}/invite`)
        expect(url.searchParams.get('code')).toBe('alice')
        expect(url.searchParams.get('utm_source')).toBe('app')
        expect(url.searchParams.get('utm_medium')).toBe('referral')
        expect(url.searchParams.get('utm_campaign')).toBe('referral')
        expect(url.searchParams.get('utm_content')).toBe('badge_unlock')
        expect(inviteLink.startsWith(`${window.location.origin}/invite?code=alice&`)).toBe(true)
    })
})
