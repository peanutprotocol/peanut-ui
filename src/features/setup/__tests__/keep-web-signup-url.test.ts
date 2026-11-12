/** @jest-environment jsdom */
import { BASE_URL } from '@/constants/general.consts'
import {
    badgeCampaignsFromSearchParams,
    getPendingBadgeCampaigns,
    queuePendingBadgeCampaigns,
} from '@/components/Invites/badge-campaign-context'
import { consumePostAuthRedirect } from '@/services/post-auth-redirect'
import { EInviteType } from '@/services/services.types'
import { setRedirectUrl, toInviteCode } from '@/utils/general.utils'
import { readInviteCode, readInviteType, stashInvite } from '@/utils/invite-stash'
import { keepWebSignupUrl } from '../keep-web-signup-url'

const HATCH = `${BASE_URL}/setup?keep-web=walnut-still-cracks`

/** A browser that shares nothing with the app: no localStorage, no cookies. */
function freshBrowser() {
    localStorage.clear()
    for (const cookie of document.cookie.split(';')) {
        const name = cookie.split('=')[0].trim()
        if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`
    }
}

/** What /setup and the post-signup redirect do with the link's params (setup/page.tsx, useAccountSetup). */
function restoreAsSetupDoes(url: string) {
    const params = new URL(url).searchParams
    const code = params.get('code')
    if (code && toInviteCode(code)) stashInvite(toInviteCode(code), EInviteType.DIRECT)
    const campaigns = badgeCampaignsFromSearchParams(params)
    if (campaigns.length > 0) queuePendingBadgeCampaigns(campaigns, 30)
    return consumePostAuthRedirect(params.get('redirect_uri'))
}

beforeEach(() => {
    freshBrowser()
    window.history.replaceState({}, '', '/setup')
})

describe('keepWebSignupUrl (TASK-24498)', () => {
    it('carries the invite, the badge campaigns and the return path into a fresh browser session', () => {
        stashInvite('alice', EInviteType.PAYMENT_LINK)
        queuePendingBadgeCampaigns(['nita', 'bug_whisperer'])
        window.history.replaceState({}, '', `/setup?redirect_uri=${encodeURIComponent('/add-money')}`)

        const url = keepWebSignupUrl()
        freshBrowser()
        expect(readInviteCode()).toBe('')
        expect(getPendingBadgeCampaigns()).toEqual([])

        expect(url.startsWith(`${HATCH}&`)).toBe(true)
        const redirect = restoreAsSetupDoes(url)
        expect(readInviteCode()).toBe('alice')
        // A bare code is a DIRECT invite, as every invite deep link is; the inviter keeps the credit.
        expect(readInviteType()).toBe(EInviteType.DIRECT)
        expect(getPendingBadgeCampaigns()).toEqual(['nita', 'bug_whisperer'])
        expect(redirect).toMatchObject({ destination: '/add-money', source: 'explicit' })
    })

    it('carries a stored deep-link destination when the URL names none', () => {
        setRedirectUrl('/request/abc', 'deep-link')

        expect(new URL(keepWebSignupUrl()).searchParams.get('redirect_uri')).toBe('/request/abc')
    })

    it.each([
        ['the page an earlier session ended on', () => setRedirectUrl('/profile', 'session-end')],
        [
            'an off-site destination',
            () => window.history.replaceState({}, '', '/setup?redirect_uri=https%3A%2F%2Fevil.example%2F'),
        ],
        [
            'a destination back into setup',
            () => window.history.replaceState({}, '', '/setup?redirect_uri=%2Fsetup%3Fstep%3Dsignup'),
        ],
    ])('carries no return path for %s', (_case, arrange) => {
        arrange()

        expect(keepWebSignupUrl()).toBe(HATCH)
    })
})
