import {
    captureSignupAttribution,
    captureTrackedLinkJourney,
    readSignupAttribution,
    readSignupAttributionAsync,
} from '@/utils/signup-attribution'
import {
    applyDeferredPayload,
    buildDeferredPayload,
    MAX_PLAY_REFERRER_LENGTH,
    parseDeferredPayload,
} from '@/utils/deferred-link'
import { readInviteCode, readInviteIntent, stashAcquisitionInvite, stashInvite } from '@/utils/invite-stash'
import { EInviteType } from '@/services/services.types'
import { parseDeferredPayload as parseLegacyPayload } from '@/utils/__tests__/fixtures/legacy-native-attribution'
import type { AcquisitionCampaign } from '../contract'
import { Preferences } from '@capacitor/preferences'

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
    isCapacitor: () => false,
    isAndroidNative: () => false,
    isIOSNative: () => false,
}))
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { has_opted_out_capturing: () => false, get_distinct_id: () => undefined },
}))

const campaign: AcquisitionCampaign = {
    source: 'twitter',
    medium: 'social',
    campaign: 'creator-launch',
    content: 'hero',
}
const savedKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
const clearCookies = () => {
    for (const item of document.cookie.split(';')) document.cookie = `${item.trim().split('=')[0]}=; Max-Age=0; path=/`
}
beforeEach(() => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_tracked_test'
    process.env.NEXT_PUBLIC_CAPACITOR_BUILD = 'false'
    localStorage.clear()
    clearCookies()
    mockNative.clear()
    window.history.replaceState({}, '', '/app?tl=alice')
})
afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
    delete (navigator as Navigator & { doNotTrack?: string }).doNotTrack
    delete (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl
    delete (document as Document & { prerendering?: boolean }).prerendering
    process.env.NEXT_PUBLIC_CAPACITOR_BUILD = 'false'
    if (savedKey === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_KEY
    else process.env.NEXT_PUBLIC_POSTHOG_KEY = savedKey
})

it.each([
    '/app?tl=alice',
    '/app/?tl=alice',
    '/home?tl=alice',
    '/home/?tl=alice',
    '/app?tracked_link=alice',
    '/go/alice',
    '/app?code=alice',
    '/home?app_entry=1&code=alice',
    '/home/?app_entry=1&code=alice',
    '/app/?code=alice',
    '/app?code=Alice',
    '/home/?app_entry=1&code=Alice',
])('default document/navigation capture waits for descriptor bootstrap on %s', (path) => {
    window.history.replaceState({}, '', path)
    expect(captureSignupAttribution({ includeDocumentReferrer: true })).toBeNull()
    expect(captureSignupAttribution()).toBeNull()
    expect(document.cookie).not.toContain('signupAttribution=')
})

it.each(['dnt', 'gpc', 'declined', 'blocked', 'prerender'] as const)(
    'does not write a tracked journey under %s, while functional inviter survives',
    async (condition) => {
        stashAcquisitionInvite('alice')
        if (condition === 'dnt') Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: '1' })
        if (condition === 'gpc')
            Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true })
        if (condition === 'declined') localStorage.setItem('__ph_opt_in_out_phc_tracked_test', '0')
        if (condition === 'blocked')
            jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
                throw new Error('blocked')
            })
        if (condition === 'prerender')
            Object.defineProperty(document, 'prerendering', { configurable: true, value: true })
        expect(captureSignupAttribution({ includeDocumentReferrer: true })).toBeNull()
        expect(await captureTrackedLinkJourney(campaign)).toBeNull()
        expect(document.cookie).not.toContain('signupAttribution=')
        const payload = parseDeferredPayload(
            buildDeferredPayload('/home', undefined, 'ios', {
                acquisitionInvite: 'alice',
                includeInviteAndBadgeContext: false,
            })
        )!
        expect(payload.attribution).toBeUndefined()
        expect(payload.acquisitionInvite).toBe('alice')
        jest.restoreAllMocks()
        expect(readInviteCode()).toBe('alice')
    }
)

it('projects the same campaign as direct tags and preserves an earlier genuine first touch', async () => {
    window.history.replaceState(
        {},
        '',
        '/?utm_source=twitter&utm_medium=social&utm_campaign=creator-launch&utm_content=hero'
    )
    const direct = captureSignupAttribution()!
    clearCookies()
    window.history.replaceState({}, '', '/app?tl=registered-campaign&utm_source=attacker')
    const tracked = (await captureTrackedLinkJourney(campaign))!
    expect(tracked.firstTouch).toMatchObject({
        utmSource: 'twitter',
        utmMedium: 'social',
        utmCampaign: 'creator-launch',
        utmContent: 'hero',
    })
    expect(tracked.firstTouch.utmCampaign).toBe(direct.firstTouch.utmCampaign)
    const next = await captureTrackedLinkJourney({ ...campaign, campaign: 'second-placement' })
    expect(next?.journeyId).toBe(tracked.journeyId)
    expect(next?.firstTouch).toEqual(tracked.firstTouch)
    expect(next?.lastTouch?.utmCampaign).toBe('second-placement')
    for (const store of ['ios', 'android'] as const) {
        const payload = parseDeferredPayload(
            buildDeferredPayload('/home', undefined, store, { includeInviteAndBadgeContext: false })
        )!
        expect(payload.attribution?.journeyId).toBe(tracked.journeyId)
        expect(payload.attribution?.lastTouch?.utmCampaign).toBe('second-placement')
    }
})

it('persists and recovers the native journey before a later tracked touch', async () => {
    process.env.NEXT_PUBLIC_CAPACITOR_BUILD = 'true'
    const first = (await captureTrackedLinkJourney(campaign))!
    clearCookies()
    expect(await readSignupAttributionAsync()).toEqual(first)
    const later = (await captureTrackedLinkJourney({ ...campaign, campaign: 'later' }))!
    expect(later.journeyId).toBe(first.journeyId)
    expect(later.firstTouch).toEqual(first.firstTouch)
    expect(JSON.parse(mockNative.get('signup-attribution')!).lastTouch.utmCampaign).toBe('later')
})

it('does not create a replacement journey when native storage is stuck', async () => {
    process.env.NEXT_PUBLIC_CAPACITOR_BUILD = 'true'
    jest.useFakeTimers()
    jest.spyOn(Preferences, 'get').mockReturnValue(new Promise(() => {}))
    const pending = captureTrackedLinkJourney(campaign)
    await jest.advanceTimersByTimeAsync(500)
    expect(await pending).toBeNull()
    expect(document.cookie).not.toContain('signupAttribution=')
    expect(mockNative.size).toBe(0)
})

it('does not write a late journey after bootstrap cancellation', async () => {
    process.env.NEXT_PUBLIC_CAPACITOR_BUILD = 'true'
    let release!: (value: { value: string | null }) => void
    jest.spyOn(Preferences, 'get').mockReturnValue(
        new Promise((resolve) => {
            release = resolve
        })
    )
    const controller = new AbortController()
    const pending = captureTrackedLinkJourney(campaign, controller.signal)
    controller.abort()
    release({ value: null })
    expect(await pending).toBeNull()
    expect(document.cookie).not.toContain('signupAttribution=')
})

it.each(['ios', 'android'] as const)('carries passive provenance in %s while old decoders ignore it', (store) => {
    stashAcquisitionInvite('alice')
    const encoded = buildDeferredPayload('/home', undefined, store, {
        acquisitionInvite: 'alice',
        includeInviteAndBadgeContext: false,
    })
    if (store === 'android') expect(encodeURIComponent(encoded).length).toBeLessThanOrEqual(MAX_PLAY_REFERRER_LENGTH)
    expect(new URLSearchParams(encoded).has('invite')).toBe(false)
    expect(parseLegacyPayload(encoded)?.invite).toBeUndefined()
    localStorage.clear()
    applyDeferredPayload(parseDeferredPayload(encoded)!)
    expect(readInviteCode()).toBe('alice')
    expect(readInviteIntent()).toBe('acquisition')
})

it('keeps an explicit choice through passive handoff and ignores passive restore over it', () => {
    stashInvite('bob', EInviteType.DIRECT)
    const encoded = buildDeferredPayload('/home', undefined, 'ios', {
        acquisitionInvite: 'alice',
        includeInviteAndBadgeContext: false,
    })
    expect(parseDeferredPayload(encoded)?.invite).toBe('bob')
    expect(parseDeferredPayload(encoded)?.acquisitionInvite).toBeUndefined()
    applyDeferredPayload({ acquisitionInvite: 'alice' })
    expect(readInviteCode()).toBe('bob')
})

it('trims Android payload bytes without downgrading the passive inviter', async () => {
    await captureTrackedLinkJourney({ ...campaign, campaign: 'x'.repeat(64), content: 'y'.repeat(64) })
    const encoded = buildDeferredPayload('/home?' + 'x'.repeat(600), undefined, 'android', {
        acquisitionInvite: 'a'.repeat(32),
        includeInviteAndBadgeContext: false,
    })
    expect(encodeURIComponent(encoded).length).toBeLessThanOrEqual(MAX_PLAY_REFERRER_LENGTH)
    expect(parseDeferredPayload(encoded)?.acquisitionInvite).toBe('a'.repeat(32))
    expect(parseLegacyPayload(encoded)?.invite).toBeUndefined()
})

it('restore rechecks native consent before persisting a tracked campaign', async () => {
    const attribution = (await captureTrackedLinkJourney(campaign))!
    clearCookies()
    localStorage.setItem('__ph_opt_in_out_phc_tracked_test', '0')
    applyDeferredPayload({ attribution, trackedLink: 'creator-campaign', acquisitionInvite: 'alice' })
    expect(readSignupAttribution()).toBeNull()
    expect(readInviteCode()).toBe('alice')
})
