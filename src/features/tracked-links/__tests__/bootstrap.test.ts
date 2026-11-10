/** @jest-environment jsdom */
import { bootstrapTrackedLinkEntry } from '../bootstrap'
import { resolveAcquisitionLinkClient } from '../resolve-client'
import { sendMarketingQrAppOpening } from '@/features/marketing-qr/appOpening'
import { captureTrackedLinkVisit } from '../capture-client'
import { bindInviteToUser, readInviteCode, readInviteIntent, readInviteUserId, stashInvite } from '@/utils/invite-stash'
import { readSignupAttribution, captureSignupAttribution } from '@/utils/signup-attribution'
import { parseDeferredPayload } from '@/utils/deferred-link'
import { EInviteType } from '@/services/services.types'
import type { ResolvedAcquisitionLink } from '../contract'

jest.mock('@/features/marketing-qr/appOpening', () => ({ sendMarketingQrAppOpening: jest.fn() }))
jest.mock('../resolve-client', () => ({ resolveAcquisitionLinkClient: jest.fn() }))
jest.mock('../capture-client', () => ({ captureTrackedLinkVisit: jest.fn() }))
jest.mock('@/utils/capacitor', () => ({
    isNativeBridge: () => false,
    isCapacitor: () => false,
    isAndroidNative: () => false,
    isIOSNative: () => false,
}))
jest.mock('posthog-js', () => ({
    has_opted_out_capturing: () => false,
    capture: jest.fn(),
    register: jest.fn(),
    get_distinct_id: () => null,
}))
const resolve = jest.mocked(resolveAcquisitionLinkClient)
const invite: ResolvedAcquisitionLink = {
    schemaVersion: 1,
    linkId: `invite_${'a'.repeat(64)}`,
    slug: 'alice',
    revision: 1,
    status: 'active',
    kind: 'invite',
    policy: 'journey',
    destination: { key: 'app-entry', continuation: '/home' },
    invite: { code: 'alice' },
}
const campaign: ResolvedAcquisitionLink = {
    schemaVersion: 1,
    linkId: 'campaign_launch',
    slug: 'c-launch',
    revision: 2,
    status: 'active',
    kind: 'campaign',
    policy: 'journey',
    destination: { key: 'app-entry', continuation: '/home' },
    campaign: { source: 'twitter', medium: 'cpc', campaign: 'launch', content: 'creative' },
}
const originalKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
function visit(search: string) {
    Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
            origin: 'https://peanut.me',
            pathname: '/app',
            search,
            href: `https://peanut.me/app${search}`,
            hash: '',
        },
    })
}
function clearCookies() {
    for (const cookie of document.cookie.split(';'))
        document.cookie = `${cookie.split('=')[0].trim()}=; Max-Age=0; path=/`
}
beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    clearCookies()
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'test-key'
    Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: undefined })
    Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: false })
    resolve.mockResolvedValue({ status: 200, link: invite })
    visit('?tl=alice&tr=1')
})
afterAll(() => {
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_KEY
    else process.env.NEXT_PUBLIC_POSTHOG_KEY = originalKey
})
it('captures passive identity before both store payloads and never creates explicit intent', async () => {
    expect(captureSignupAttribution()).toBeNull()
    const result = await bootstrapTrackedLinkEntry(new URLSearchParams(window.location.search), false)
    expect(readInviteCode()).toBe('alice')
    expect(readInviteIntent()).toBe('acquisition')
    for (const raw of [result.payload, result.iosPayload]) {
        const payload = parseDeferredPayload(raw!)!
        expect(payload.acquisitionInvite).toBe('alice')
        expect(payload.invite).toBeUndefined()
        expect(payload.attribution?.journeyId).toBe(readSignupAttribution()?.journeyId)
        expect(payload.dest ?? '/home').toBe('/home')
    }
    expect(new URL(result.openAppHref!).pathname).toBe('/home')
    expect(new URL(result.openAppHref!).searchParams.get('tl_seen')).toBe('1')
})
it.each(['denied', 'dnt', 'gpc'])('keeps functional invite while suppressing journey for %s', async (reason) => {
    if (reason === 'denied') localStorage.setItem('__ph_opt_in_out_test-key', '0')
    if (reason === 'dnt') Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: '1' })
    if (reason === 'gpc') Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true })
    const result = await bootstrapTrackedLinkEntry(new URLSearchParams(window.location.search), false)
    expect(readInviteIntent()).toBe('acquisition')
    expect(parseDeferredPayload(result.payload!)?.acquisitionInvite).toBe('alice')
    expect(parseDeferredPayload(result.payload!)?.attribution).toBeUndefined()
    expect(readSignupAttribution()).toBeNull()
    expect(captureTrackedLinkVisit).toHaveBeenCalledWith(invite, expect.objectContaining({ journey: null }))
})
it('preserves explicit pending inviter priority through a passive opening', async () => {
    stashInvite('bob', EInviteType.DIRECT)
    const result = await bootstrapTrackedLinkEntry(new URLSearchParams(window.location.search), false)
    expect(readInviteCode()).toBe('bob')
    expect(readInviteIntent()).toBe('explicit')
    expect(parseDeferredPayload(result.payload!)?.invite).toBeUndefined()
    expect(parseDeferredPayload(result.payload!)?.acquisitionInvite).toBe('bob')
})
it('projects the same registered campaign into web and native journeys and both store handoffs', async () => {
    resolve.mockResolvedValue({ status: 200, link: campaign })
    let expected: unknown
    for (const native of [false, true]) {
        clearCookies()
        visit('?tl=c-launch&tr=1&utm_source=mallory&utm_medium=email&utm_campaign=untrusted')
        expect(captureSignupAttribution()).toBeNull()
        const result = await bootstrapTrackedLinkEntry(new URLSearchParams(window.location.search), native)
        const touch = readSignupAttribution()!.firstTouch
        expect(touch).toMatchObject({
            utmSource: 'twitter',
            utmMedium: 'cpc',
            utmCampaign: 'launch',
            utmContent: 'creative',
        })
        const { occurredAt, ...marketing } = touch
        if (expected) expect(marketing).toEqual(expected)
        expected = marketing
        for (const raw of [result.payload, result.iosPayload]) {
            const attribution = parseDeferredPayload(raw!)?.attribution
            expect(attribution?.lastTouch ?? attribution?.firstTouch).toMatchObject(marketing)
        }
    }
})
it('preserves earlier genuine first touch while updating registered last touch', async () => {
    visit('?utm_source=google&utm_medium=cpc&utm_campaign=earlier')
    const first = captureSignupAttribution()!
    visit('?tl=c-launch')
    resolve.mockResolvedValue({ status: 200, link: campaign })
    await bootstrapTrackedLinkEntry(new URLSearchParams(window.location.search), false)
    expect(readSignupAttribution()?.journeyId).toBe(first.journeyId)
    expect(readSignupAttribution()?.firstTouch).toEqual(first.firstTouch)
    expect(readSignupAttribution()?.lastTouch?.utmCampaign).toBe('launch')
})
it('marks browser-to-app continuation and install restoration as already observed', async () => {
    const browser = await bootstrapTrackedLinkEntry(new URLSearchParams(window.location.search), false)
    jest.mocked(captureTrackedLinkVisit).mockClear()
    const params = new URL(browser.openAppHref!).searchParams
    await bootstrapTrackedLinkEntry(params, true)
    expect(captureTrackedLinkVisit).toHaveBeenCalledWith(
        invite,
        expect.objectContaining({ openedIn: 'app', seen: true })
    )
})
it('does not forward stale handoff campaign context without rebuilding the captured journey', async () => {
    visit('?tl=c-launch&pnutdl=1&dest=%2Fsend')
    resolve.mockResolvedValue({ status: 200, link: campaign })
    const result = await bootstrapTrackedLinkEntry(new URLSearchParams(window.location.search), false)
    const attribution = parseDeferredPayload(result.iosPayload!)?.attribution
    expect((attribution?.lastTouch ?? attribution?.firstTouch)?.utmCampaign).toBe('launch')
    expect(parseDeferredPayload(result.iosPayload!)?.dest).toBe('/home')
})
it('rejects duplicate ownership and unknown legacy campaign codes without a stash write', async () => {
    expect(await bootstrapTrackedLinkEntry(new URLSearchParams('tl=alice&tl=bob'), false)).toEqual({
        payload: null,
        iosPayload: null,
    })
    expect(resolve).not.toHaveBeenCalled()
    resolve.mockResolvedValue({ status: 404 })
    await bootstrapTrackedLinkEntry(new URLSearchParams('code=campaign2026'), false)
    expect(readInviteCode()).toBe('')
})
it('does not capture after the navigation deadline cancels resolution', async () => {
    const controller = new AbortController()
    resolve.mockImplementation(async () => {
        controller.abort()
        return { status: 200, link: invite }
    })
    await bootstrapTrackedLinkEntry(new URLSearchParams('tl=alice'), false, controller.signal)
    expect(readInviteCode()).toBe('')
    expect(captureTrackedLinkVisit).not.toHaveBeenCalled()
})

it('keeps a functional handoff under blocked storage without creating a journey', async () => {
    const blocked = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked')
    })
    try {
        const result = await bootstrapTrackedLinkEntry(new URLSearchParams('tl=alice'), false)
        expect(parseDeferredPayload(result.payload!)?.acquisitionInvite).toBe('alice')
        expect(parseDeferredPayload(result.payload!)?.attribution).toBeUndefined()
    } finally {
        blocked.mockRestore()
    }
})

it('validates historical mixed-case legacy codes without treating them as campaign identities', async () => {
    visit('?code=Alice')
    await bootstrapTrackedLinkEntry(new URLSearchParams(window.location.search), false)
    expect(resolve).toHaveBeenCalledWith('alice')
    expect(readInviteIntent()).toBe('acquisition')
    expect(captureTrackedLinkVisit).not.toHaveBeenCalled()
})
it('routes QR aliases through the existing personless sender without making a journey', async () => {
    resolve.mockResolvedValue({
        status: 200,
        link: {
            ...campaign,
            slug: 'qr-home-hero-en',
            kind: 'marketing_qr',
            invite: undefined,
            policy: 'personless',
            qr: { id: 'home-hero-en' },
        },
    })
    await bootstrapTrackedLinkEntry(new URLSearchParams('tracked_link=qr-home-hero-en'), true)
    expect(sendMarketingQrAppOpening).toHaveBeenCalledWith(new URL('https://peanut.me/home?mqr=home-hero-en'))
    expect(readSignupAttribution()).toBeNull()
    expect(captureTrackedLinkVisit).not.toHaveBeenCalled()
})

it('keeps an app-owned retry when opening a passive handoff from a different browser choice', async () => {
    stashInvite('bob', EInviteType.DIRECT)
    const browser = await bootstrapTrackedLinkEntry(new URLSearchParams(window.location.search), false)
    const params = new URL(browser.openAppHref!).searchParams
    expect(params.has('invite')).toBe(false)
    localStorage.clear()
    stashInvite('carol', EInviteType.DIRECT)
    bindInviteToUser('account-a')
    await bootstrapTrackedLinkEntry(params, true)
    expect(readInviteCode()).toBe('carol')
    expect(readInviteIntent()).toBe('explicit')
    expect(readInviteUserId()).toBe('account-a')
})
it.each(['tl=alice', 'tracked_link=alice', 'code=alice'])(
    'treats restored legacy invite as passive on %s and preserves an app retry',
    async (entry) => {
        const params = new URLSearchParams(`${entry}&pnutdl=1&invite=bob`)
        await bootstrapTrackedLinkEntry(params, true)
        expect(readInviteCode()).toBe('bob')
        expect(readInviteIntent()).toBe('acquisition')
        expect(readInviteUserId()).toBe('')
        stashInvite('carol', EInviteType.DIRECT)
        bindInviteToUser('account-a')
        await bootstrapTrackedLinkEntry(params, true)
        expect(readInviteCode()).toBe('carol')
        expect(readInviteIntent()).toBe('explicit')
        expect(readInviteUserId()).toBe('account-a')
    }
)
