/** @jest-environment jsdom */
import { randomUUID } from 'node:crypto'
import posthog from 'posthog-js'
import { Preferences } from '@capacitor/preferences'
import { getPendingBadgeCampaigns } from '@/components/Invites/badge-campaign-context'
import { EInviteType } from '@/services/services.types'
import { applyDeferredPayload, parseDeferredPayload } from '@/utils/deferred-link'
import { bindInviteToUser, readInviteCode, readInviteIntent, readInviteUserId, stashInvite } from '@/utils/invite-stash'
import { deepLinkToNativePath } from '@/utils/native-routes'
import {
    captureSignupAttribution,
    captureTrackedLinkJourney,
    readSignupAttribution,
    readSignupAttributionAsync,
    type SignupAttributionContext,
} from '@/utils/signup-attribution'
import { parseDeferredPayload as parseLegacyPayload } from '@/utils/__tests__/fixtures/legacy-native-attribution'
import { bootstrapTrackedLinkEntry, EMPTY_TRACKED_LINK_BOOTSTRAP, enterGoPage } from '../bootstrap'
import { bareGoVisit, goHandoffPath } from '../contract'
import { GO_ALIASES, withGoAlias } from '../go-aliases'

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

it('never assigns an inviter other than the tracked creator', async () => {
    await bootstrapTrackedLinkEntry(visit('/app?tl=alice&acq_invite=bob'), false)
    expect(readInviteCode()).toBe('')
    // A direct associated URL, mapped the way the app maps it.
    const path = deepLinkToNativePath('https://peanut.me/home?app_entry=1&tl=alice&acq_invite=bob')!
    await bootstrapTrackedLinkEntry(new URL(path, 'https://peanut.me').searchParams, true)
    expect(readInviteCode()).toBe('')
    // A deferred store payload.
    applyDeferredPayload(parseDeferredPayload('pnutdl=1&tl=alice&acq_invite=bob')!)
    expect(readInviteCode()).toBe('')
    applyDeferredPayload(parseDeferredPayload('pnutdl=1&tl=alice&acq_invite=alice')!)
    expect(readInviteCode()).toBe('alice')
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

describe('/go tags', () => {
    const tagged = () => `/app?tl=${slug}&acq_invite=${slug}&tl_s=ig&utm_campaign=release-check&tl_r=l.instagram.com`

    it('writes the tags as the journey touch and sends them with the visit', async () => {
        await bootstrapTrackedLinkEntry(visit(tagged()), false)
        expect(readSignupAttribution()?.lastTouch).toEqual({
            occurredAt: expect.any(String),
            utmSource: 'instagram',
            utmMedium: 'ambassador',
            utmCampaign: 'release-check',
            referrerHost: 'l.instagram.com',
        })
        expect(visits()[0].body).toMatchObject({
            placement: 'ig',
            code: null,
            utm_source: null,
            utm_medium: null,
            utm_campaign: 'release-check',
            utm_content: null,
            referrer_host: 'l.instagram.com',
        })
    })

    it('writes the default touch for a bare /go link', async () => {
        await bootstrapTrackedLinkEntry(visit(`/app?tl=${slug}&acq_invite=${slug}`), false)
        expect(readSignupAttribution()?.lastTouch).toEqual({
            occurredAt: expect.any(String),
            utmMedium: 'ambassador',
            utmCampaign: 'go',
        })
    })

    it('keeps the empty touch for a legacy /app?code= link', async () => {
        visit('/?utm_source=google&utm_medium=cpc&utm_campaign=earlier')
        const earlier = captureSignupAttribution()!
        await bootstrapTrackedLinkEntry(visit('/app?code=alice&utm_campaign=forged'), false)
        expect(readSignupAttribution()?.lastTouch).toEqual(earlier.lastTouch)
    })

    it('writes the tags of a direct app opening', async () => {
        await bootstrapTrackedLinkEntry(openInApp(`https://peanut.me/home?app_entry=1&${tagged().slice(5)}`), true)
        expect(readSignupAttribution()?.lastTouch).toMatchObject({ utmSource: 'instagram' })
    })

    // The handoff drops a last touch equal to the first, so restore may leave it out; a new touch would set one.
    const expectRestored = (journey: SignupAttributionContext) => {
        const restored = readSignupAttribution()!
        expect(restored).toMatchObject({ journeyId: journey.journeyId, firstTouch: journey.firstTouch })
        expect([undefined, journey.lastTouch]).toContainEqual(restored.lastTouch)
    }

    it('leaves the restored journey unchanged in the app, with tl_seen or with a deferred handoff', async () => {
        const browser = await bootstrapTrackedLinkEntry(visit(tagged()), false)
        const journey = readSignupAttribution()!
        const at = new URLSearchParams(browser.iosPayload!).get('at')!
        clearDevice()
        await bootstrapTrackedLinkEntry(openInApp(browser.openAppHref!), true)
        expectRestored(journey)

        clearDevice()
        await bootstrapTrackedLinkEntry(
            new URLSearchParams(`tl=${slug}&acq_invite=${slug}&pnutdl=1&at=${at}&tl_s=x&utm_campaign=other`),
            true
        )
        expectRestored(journey)
    })

    it.each([false, true])("queues the creator's badge campaign, also under DNT (dnt: %s)", async (dnt) => {
        if (dnt) Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: '1' })
        const result = await bootstrapTrackedLinkEntry(visit('/app?tl=juanacervio&acq_invite=juanacervio'), false)
        expect(getPendingBadgeCampaigns()).toEqual(['nita'])
        expect(new URLSearchParams(result.payload!).getAll('badge_campaign')).toEqual(['nita'])
    })

    it('stashes the company inviter for an alias handoff and records its poster code and campaign', async () => {
        const handoff = goHandoffPath(withGoAlias({ ...bareGoVisit('squirrel'), code: 1 }, GO_ALIASES.palermo))
        await bootstrapTrackedLinkEntry(visit(handoff.replace('/home', '/app')), false)
        expect(readInviteCode()).toBe('squirrel')
        expect(readInviteIntent()).toBe('acquisition')
        expect(getPendingBadgeCampaigns()).toEqual([])
        expect(readSignupAttribution()?.lastTouch).toEqual({
            occurredAt: expect.any(String),
            utmMedium: 'cpm',
            utmCampaign: 'palermo',
            utmContent: 'c1',
        })
        expect(visits()[0].body).toMatchObject({
            slug: 'squirrel',
            code: 1,
            utm_medium: 'cpm',
            utm_campaign: 'palermo',
        })
    })

    it.each(['/app?tl=unmapped&acq_invite=unmapped', '/app?code=juanacervio', '/app?tl=constructor'])(
        'queues no badge campaign for %s',
        async (path) => {
            await bootstrapTrackedLinkEntry(visit(path), false)
            expect(getPendingBadgeCampaigns()).toEqual([])
        }
    )
})

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

describe('the /go page entry', () => {
    const handoff = (page = '&tl_v=a1&tl_e=n1') =>
        new URLSearchParams(`app_entry=1&tl=${slug}&acq_invite=${slug}&tl_s=ig${page}`)
    const marker = () => sessionStorage.getItem(`peanut:tl-visit:${slug}`)
    // The visit dedupe window would hide a second count; only the marker may stop it here.
    const afterReplayWindow = () => jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 10_000)
    beforeEach(() => {
        sessionStorage.clear()
        visit(`/go/${slug}/ig`)
    })

    it('counts one visit with the page variant, then the CTA’s /app skips it once', async () => {
        await enterGoPage(handoff())
        expect(visits()).toEqual([
            {
                url: '/api/tracked-links/open',
                body: expect.objectContaining({ slug, placement: 'ig', page_variant: 'a1', page_experiment: 'n1' }),
            },
        ])
        expect(readSignupAttribution()?.lastTouch).toMatchObject({ utmSource: 'instagram', utmMedium: 'ambassador' })
        expect(marker()).toBe('1')

        fetchMock.mockClear()
        afterReplayWindow()
        await bootstrapTrackedLinkEntry(visit(`/app?${handoff()}`), false)
        expect(fetchMock).not.toHaveBeenCalled()
        expect(marker()).toBeNull()
        await bootstrapTrackedLinkEntry(visit(`/app?${handoff()}`), false)
        expect(visits()).toHaveLength(1)
    })

    it('counts the page once per tab when the visitor comes back to it or reloads it', async () => {
        await enterGoPage(handoff())
        await bootstrapTrackedLinkEntry(visit(`/app?${handoff()}`), false)
        afterReplayWindow()
        visit(`/go/${slug}/ig`)
        await enterGoPage(handoff())
        expect(visits()).toHaveLength(1)
        // The CTA tapped again still opens /app without a count.
        expect(marker()).toBe('1')
        await bootstrapTrackedLinkEntry(visit(`/app?${handoff()}`), false)
        expect(visits()).toHaveLength(1)
    })

    it('counts a tap made before the page hydrated once, at /app, with the variant', async () => {
        await bootstrapTrackedLinkEntry(visit(`/app?${handoff()}`), false)
        expect(visits()).toEqual([
            {
                url: '/api/tracked-links/open',
                body: expect.objectContaining({ slug, page_variant: 'a1', page_experiment: 'n1' }),
            },
        ])
    })

    it('records no variant for a creator without a page, and drops a bad label', async () => {
        await enterGoPage(handoff(''))
        afterReplayWindow()
        sessionStorage.clear()
        await bootstrapTrackedLinkEntry(visit(`/app?${handoff('&tl_v=A1&tl_e=n1')}`), false)
        for (const { body } of visits()) expect(body).toMatchObject({ page_variant: null, page_experiment: null })
        expect(visits()).toHaveLength(2)
    })

    it.each(['dnt', 'gpc', 'declined'] as const)(
        'under %s keeps the stash and the badge, but writes no journey and sends no visit',
        async (condition) => {
            if (condition === 'dnt') Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: '1' })
            if (condition === 'gpc')
                Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true })
            if (condition === 'declined') localStorage.setItem('__ph_opt_in_out_phc_tracked_test', '0')
            visit('/go/juanacervio/ig')
            await enterGoPage(new URLSearchParams('app_entry=1&tl=juanacervio&acq_invite=juanacervio&tl_s=ig'))
            expect(readInviteCode()).toBe('juanacervio')
            expect(readInviteIntent()).toBe('acquisition')
            expect(getPendingBadgeCampaigns()).toContain('nita')
            expect(document.cookie).not.toContain('signupAttribution')
            expect(fetchMock).not.toHaveBeenCalled()
        }
    )
})
