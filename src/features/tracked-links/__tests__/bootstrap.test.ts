/** @jest-environment jsdom */
import { randomUUID } from 'node:crypto'
import posthog from 'posthog-js'
import { Preferences } from '@capacitor/preferences'
import { EInviteType } from '@/services/services.types'
import { applyDeferredPayload, parseDeferredPayload } from '@/utils/deferred-link'
import { bindInviteToUser, readInviteCode, readInviteIntent, readInviteUserId, stashInvite } from '@/utils/invite-stash'
import { deepLinkToNativePath } from '@/utils/native-routes'
import {
    captureSignupAttribution,
    captureTrackedLinkJourney,
    readSignupAttribution,
    readSignupAttributionAsync,
} from '@/utils/signup-attribution'
import { parseDeferredPayload as parseLegacyPayload } from '@/utils/__tests__/fixtures/legacy-native-attribution'
import { bootstrapTrackedLinkEntry, EMPTY_TRACKED_LINK_BOOTSTRAP } from '../bootstrap'

const WEB_ID = '44444444-4444-4444-8444-444444444444'
const mockNative = new Map<string, string>()
jest.mock('@capacitor/preferences', () => ({
    Preferences: {
        get: async ({ key }: { key: string }) => ({ value: mockNative.get(key) ?? null }),
        set: async ({ key, value }: { key: string; value: string }) => {
            mockNative.set(key, value)
        },
        remove: async ({ key }: { key: string }) => {
            mockNative.delete(key)
        },
    },
}))
jest.mock('@capacitor/core', () => ({ registerPlugin: jest.fn(() => ({})) }))
jest.mock('@/utils/capacitor', () => ({
    isCapacitor: () => true,
    isNativeBridge: () => false,
    isAndroidNative: () => false,
    isIOSNative: () => false,
}))
jest.mock('@/utils/posthog-setup', () => ({
    ...jest.requireActual('@/utils/posthog-setup'),
    isAnalyticsCaptureBuild: () => true,
}))
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: {
        has_opted_out_capturing: () => false,
        get_distinct_id: () => '44444444-4444-4444-8444-444444444444',
        _isIdentified: () => false,
        register_once: jest.fn(),
        register: jest.fn(),
        capture: jest.fn(),
    },
}))

const fetchMock = jest.fn(async (_url: string, _init?: RequestInit) => new Response(null, { status: 204 }))
const visits = () => fetchMock.mock.calls.map(([url, init]) => ({ url, body: JSON.parse(init!.body as string) }))
// The visit dedupe is per slug per page load; a fresh slug per test keeps each visit observable.
let n = 0
let slug = ''
const savedKey = process.env.NEXT_PUBLIC_POSTHOG_KEY

function clearDevice() {
    localStorage.clear()
    mockNative.clear()
    for (const cookie of document.cookie.split(';'))
        document.cookie = `${cookie.split('=')[0].trim()}=; Max-Age=0; path=/`
}
function visit(path: string) {
    window.history.replaceState({}, '', path)
    return new URLSearchParams(window.location.search)
}
/** What the native app's /app page receives when the OS hands it this URL. */
function openInApp(href: string) {
    return visit(deepLinkToNativePath(href)!)
}

beforeEach(() => {
    jest.clearAllMocks()
    clearDevice()
    slug = `creator${n++}`
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_tracked_test'
    process.env.NEXT_PUBLIC_CAPACITOR_BUILD = 'false'
    global.fetch = fetchMock as unknown as typeof fetch
    // jsdom lacks randomUUID; every browser this page supports has it.
    Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: randomUUID })
})
afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
    Reflect.deleteProperty(navigator, 'doNotTrack')
    Reflect.deleteProperty(navigator, 'globalPrivacyControl')
    Reflect.deleteProperty(document, 'prerendering')
    if (savedKey === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_KEY
    else process.env.NEXT_PUBLIC_POSTHOG_KEY = savedKey
})

it('stashes the creator passively and builds both store handoffs around the new journey', async () => {
    const result = await bootstrapTrackedLinkEntry(visit(`/app?tl=${slug}&acq_invite=${slug}`), false)
    expect(readInviteCode()).toBe(slug)
    expect(readInviteIntent()).toBe('acquisition')
    const journeyId = readSignupAttribution()?.journeyId
    expect(journeyId).toBeDefined()
    for (const raw of [result.payload!, result.iosPayload!]) {
        expect(parseDeferredPayload(raw)).toMatchObject({ acquisitionInvite: slug, trackedLink: slug, dest: '/home' })
        expect(parseDeferredPayload(raw)?.invite).toBeUndefined()
        expect(parseLegacyPayload(raw)?.invite).toBeUndefined()
        expect(parseDeferredPayload(raw)?.attribution?.journeyId).toBe(journeyId)
    }
    const openApp = new URL(result.openAppHref!)
    expect(openApp.origin + openApp.pathname).toBe('https://peanut.me/home')
    expect(openApp.searchParams.get('app_entry')).toBe('1')
    expect(openApp.searchParams.get('tl_seen')).toBe('1')
    expect(openApp.searchParams.has('dest')).toBe(false)
    expect(visits()).toEqual([
        {
            url: '/api/tracked-links/open',
            body: expect.objectContaining({ slug, signup_journey_id: journeyId }),
        },
    ])
})

it('carries an explicit invite through a tracked handoff to the installed app', async () => {
    // The visitor accepted a friend's /invite link, then opened a creator's /go link.
    stashInvite('friend', EInviteType.DIRECT)
    const result = await bootstrapTrackedLinkEntry(visit(`/app?tl=${slug}&acq_invite=${slug}`), false)
    expect(readInviteCode()).toBe('friend')
    const payload = parseDeferredPayload(result.payload!)!
    expect(payload.invite).toBe('friend')
    expect(payload.acquisitionInvite).toBeUndefined()
    expect(new URL(result.openAppHref!).searchParams.get('invite')).toBe('friend')

    clearDevice()
    applyDeferredPayload(payload)
    expect(readInviteCode()).toBe('friend')
    expect(readInviteIntent()).toBe('explicit')
})

it.each(['dnt', 'gpc', 'declined', 'prerender'] as const)(
    'keeps the passive inviter but creates no journey or visit under %s',
    async (condition) => {
        if (condition === 'dnt') Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: '1' })
        if (condition === 'gpc')
            Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true })
        if (condition === 'declined') localStorage.setItem('__ph_opt_in_out_phc_tracked_test', '0')
        if (condition === 'prerender')
            Object.defineProperty(document, 'prerendering', { configurable: true, value: true })
        const result = await bootstrapTrackedLinkEntry(visit(`/app?tl=${slug}&acq_invite=${slug}`), false)
        expect(readInviteIntent()).toBe('acquisition')
        expect(parseDeferredPayload(result.payload!)?.acquisitionInvite).toBe(slug)
        expect(parseDeferredPayload(result.payload!)?.attribution).toBeUndefined()
        expect(parseDeferredPayload(result.payload!)?.webDistinctId).toBeUndefined()
        expect(readSignupAttribution()).toBeNull()
        expect(fetchMock).not.toHaveBeenCalled()
    }
)

it('continues the browser journey in the app without a second visit, and joins the web visitor id', async () => {
    const browser = await bootstrapTrackedLinkEntry(visit(`/app?tl=${slug}&acq_invite=${slug}`), false)
    const journeyId = readSignupAttribution()!.journeyId
    expect(new URL(browser.openAppHref!).searchParams.get('wid')).toBe(WEB_ID)
    fetchMock.mockClear()
    clearDevice()

    expect(await bootstrapTrackedLinkEntry(openInApp(browser.openAppHref!), true)).toEqual(EMPTY_TRACKED_LINK_BOOTSTRAP)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(readInviteCode()).toBe(slug)
    expect(readInviteIntent()).toBe('acquisition')
    expect(readSignupAttribution()?.journeyId).toBe(journeyId)
    expect(posthog.register_once).toHaveBeenCalledWith({ web_distinct_id: WEB_ID })
})

it('counts a direct app opening once, against the web origin', async () => {
    await bootstrapTrackedLinkEntry(openInApp(`https://peanut.me/home?app_entry=1&tl=${slug}&acq_invite=${slug}`), true)
    expect(readInviteIntent()).toBe('acquisition')
    expect(visits()).toEqual([
        { url: 'https://peanut.me/api/tracked-links/open', body: expect.objectContaining({ slug }) },
    ])
})

it('does not count an opening the browser already counted', async () => {
    await bootstrapTrackedLinkEntry(
        openInApp(`https://peanut.me/home?app_entry=1&tl=${slug}&acq_invite=${slug}&tl_seen=1`),
        true
    )
    expect(readInviteIntent()).toBe('acquisition')
    expect(fetchMock).not.toHaveBeenCalled()
})

it("keeps the app's own pending retry when a passive browser handoff arrives", async () => {
    const browser = await bootstrapTrackedLinkEntry(visit(`/app?tl=${slug}&acq_invite=${slug}`), false)
    clearDevice()
    stashInvite('carol', EInviteType.DIRECT)
    bindInviteToUser('account-a')
    await bootstrapTrackedLinkEntry(openInApp(browser.openAppHref!), true)
    expect(readInviteCode()).toBe('carol')
    expect(readInviteIntent()).toBe('explicit')
    expect(readInviteUserId()).toBe('account-a')
})

it('upgrades a distributed legacy /app?code= link without counting a visit', async () => {
    const result = await bootstrapTrackedLinkEntry(visit('/app?code=Alice'), false)
    expect(readInviteCode()).toBe('alice')
    expect(readInviteIntent()).toBe('acquisition')
    expect(parseDeferredPayload(result.payload!)).toMatchObject({ acquisitionInvite: 'alice', trackedLink: 'alice' })
    expect(fetchMock).not.toHaveBeenCalled()
})

it.each(['/app?tl=al-ice&acq_invite=alice', '/app?code=al%2Fice', '/app?tl=alice&acq_invite=Mallory%20'])(
    'stashes nothing that is not a username: %s',
    async (path) => {
        await bootstrapTrackedLinkEntry(visit(path), false)
        expect(readInviteCode()).toBe('')
    }
)

it.each(['/app?tl=alice', '/app/?tl=alice', '/app?code=alice', '/app/?code=Alice'])(
    'leaves %s to the bootstrap instead of default attribution capture',
    (path) => {
        visit(path)
        expect(captureSignupAttribution({ includeDocumentReferrer: true })).toBeNull()
        expect(captureSignupAttribution()).toBeNull()
        expect(document.cookie).not.toContain('signupAttribution=')
    }
)

it('keeps an earlier genuine first touch in the same journey', async () => {
    visit('/?utm_source=google&utm_medium=cpc&utm_campaign=earlier')
    const first = captureSignupAttribution()!
    await bootstrapTrackedLinkEntry(visit(`/app?tl=${slug}&acq_invite=${slug}`), false)
    expect(readSignupAttribution()?.journeyId).toBe(first.journeyId)
    expect(readSignupAttribution()?.firstTouch).toEqual(first.firstTouch)
})

it('persists and recovers the native journey before a later tracked touch', async () => {
    process.env.NEXT_PUBLIC_CAPACITOR_BUILD = 'true'
    const first = (await captureTrackedLinkJourney())!
    for (const cookie of document.cookie.split(';'))
        document.cookie = `${cookie.split('=')[0].trim()}=; Max-Age=0; path=/`
    expect(await readSignupAttributionAsync()).toEqual(first)
    const later = (await captureTrackedLinkJourney())!
    expect(later.journeyId).toBe(first.journeyId)
    expect(later.firstTouch).toEqual(first.firstTouch)
})

it('does not create a replacement journey when native storage is stuck', async () => {
    process.env.NEXT_PUBLIC_CAPACITOR_BUILD = 'true'
    jest.useFakeTimers()
    jest.spyOn(Preferences, 'get').mockReturnValue(new Promise(() => {}))
    const pending = captureTrackedLinkJourney()
    await jest.advanceTimersByTimeAsync(500)
    expect(await pending).toBeNull()
    expect(document.cookie).not.toContain('signupAttribution=')
    expect(mockNative.size).toBe(0)
})
