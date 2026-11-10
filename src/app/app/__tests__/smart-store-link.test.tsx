/** @jest-environment jsdom */
jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

/**
 * /app — the smart store link a download QR encodes.
 *
 * The branching here is the whole deferred-deep-link hand-off: android may
 * bounce automatically because the payload rides the Play install referrer,
 * iOS may NOT, because the clipboard write only succeeds inside the tap. A
 * regression that auto-redirects iOS loses the context for every scan without
 * anything visibly breaking.
 */
import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { STORE_URL } from '@/constants/migration.consts'
import { parseDeferredPayload } from '@/utils/deferred-link'
import { captureSignupAttribution, readSignupAttribution } from '@/utils/signup-attribution'
import { saveToCookie } from '@/utils/cookie-url.utils'
import { stashInvite } from '@/utils/invite-stash'
import { EInviteType } from '@/services/services.types'

let mockAnalyticsAllowed = true
jest.mock('@/features/marketing-qr/consent', () => ({ marketingQrAnalyticsAllowed: () => mockAnalyticsAllowed }))

let mockDeviceType = 'web'
jest.mock('@/hooks/useGetDeviceType', () => ({
    ...jest.requireActual('@/hooks/useGetDeviceType'),
    useDeviceType: () => ({ deviceType: mockDeviceType }),
}))

const mockReplace = jest.fn()
const mockNotFound = jest.fn()
const mockRouter = { replace: mockReplace }
jest.mock('next/navigation', () => ({
    useRouter: () => mockRouter,
    notFound: () => mockNotFound(),
}))

jest.mock('nuqs', () => ({
    parseAsString: {},
    useQueryStates: (keys: Record<string, unknown>) => [
        Object.fromEntries(Object.keys(keys).map((key) => [key, new URLSearchParams(window.location.search).get(key)])),
    ],
}))

jest.mock('posthog-js', () => ({ capture: jest.fn() }))

let mockNative = false
jest.mock('@/utils/capacitor', () => ({
    isNativeBridge: () => mockNative,
    isCapacitor: () => false,
    isAndroidNative: () => false,
    isIOSNative: () => false,
    openExternalUrl: jest.fn(),
}))

jest.mock('@/utils/migration.utils', () => ({
    storeForDevice: jest.requireActual('@/utils/migration.utils').storeForDevice,
    storeIcon: jest.requireActual('@/utils/migration.utils').storeIcon,
    trackStoreClick: jest.fn(),
}))

// the marker check is the real one (pinned in deferred-link.test.ts); only the
// side-effecting ends are stubbed so the test can see what changed hands
const mockCopyIOSHandoff = jest.fn().mockResolvedValue(undefined)
const mockTrackHandoffCreated = jest.fn()
const mockApplyDeferredPayload = jest.fn<{ dest: string | null; locale: null }, [unknown]>(() => ({
    dest: null,
    locale: null,
}))
jest.mock('@/utils/deferred-link', () => ({
    ...jest.requireActual('@/utils/deferred-link'),
    copyIOSHandoff: (...args: unknown[]) => mockCopyIOSHandoff(...args),
    trackDeferredHandoffCreated: (...args: unknown[]) => mockTrackHandoffCreated(...args),
    applyDeferredPayload: (payload: unknown) => mockApplyDeferredPayload(payload),
}))

jest.mock('@/components/Migration/MigrationHero', () => ({
    __esModule: true,
    default: () => <div data-testid="hero" />,
}))

import { trackStoreClick } from '@/utils/migration.utils'
import SmartStoreRedirect from '../page'
import { resolveAcquisitionLinkClient } from '@/features/tracked-links/resolve-client'
import type { ResolvedAcquisitionLink } from '@/features/tracked-links/contract'
jest.mock('@/features/tracked-links/resolve-client', () => ({ resolveAcquisitionLinkClient: jest.fn() }))

const PAYLOAD = 'pnutdl=1&lang=pt-br&invite=ABC123&dest=%2Fsend'
const locationReplace = jest.fn()
const locationAssign = jest.fn()

function visit(search: string, pathname = '/app') {
    Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
            origin: 'https://peanut.me',
            pathname,
            search,
            href: `https://peanut.me${pathname}${search}`,
            replace: locationReplace,
            assign: locationAssign,
        },
    })
}

const renderPage = () => render(<SmartStoreRedirect />, { wrapper: IntlWrapper })
const storeButton = (name: RegExp) => screen.getByRole('button', { name })

beforeEach(() => {
    jest.clearAllMocks()
    mockAnalyticsAllowed = true
    localStorage.clear()
    for (const cookie of document.cookie.split(';')) {
        document.cookie = `${cookie.split('=')[0].trim()}=; Max-Age=0; path=/`
    }
    mockDeviceType = 'web'
    mockNative = false
    visit('')
})

describe('/app smart store link', () => {
    it('bounces a bare visit straight to the device store (today’s behaviour)', () => {
        mockDeviceType = 'ios'
        renderPage()
        expect(locationReplace).toHaveBeenCalledWith(STORE_URL.ios)
        expect(mockTrackHandoffCreated).not.toHaveBeenCalled()
    })

    it('bounces android with the payload on the install referrer', () => {
        mockDeviceType = 'android'
        visit(`?${PAYLOAD}`)
        renderPage()
        expect(locationReplace).toHaveBeenCalledWith(`${STORE_URL.android}&referrer=${encodeURIComponent(PAYLOAD)}`)
        expect(mockTrackHandoffCreated).toHaveBeenCalledWith('android')
    })

    /*
     * DEFERRED_LINK_HANDOFF_CREATED is the denominator for
     * DEFERRED_LINK_RESTORED. The auto-redirect counts one; when the store
     * intent does not take over the buttons come back clickable, and a tap
     * used to count a second for the same visit — deflating the match rate on
     * exactly the devices where the bounce is flaky.
     */
    it('counts the android hand-off once per visit, redirect plus tap', () => {
        mockDeviceType = 'android'
        visit(`?${PAYLOAD}`)
        renderPage()
        expect(mockTrackHandoffCreated).toHaveBeenCalledTimes(1)
        fireEvent.click(storeButton(/google play/i))
        expect(mockTrackHandoffCreated).toHaveBeenCalledTimes(1)
    })

    it('never auto-redirects iOS with a payload — the clipboard needs the tap', () => {
        mockDeviceType = 'ios'
        visit(`?${PAYLOAD}`)
        renderPage()
        expect(locationReplace).not.toHaveBeenCalled()
        expect(storeButton(/google play/i)).toBeInTheDocument()

        fireEvent.click(storeButton(/app store/i))
        expect(mockCopyIOSHandoff).toHaveBeenCalledWith(PAYLOAD)
        expect(trackStoreClick).toHaveBeenCalledWith('ios', 'smart_link', true)
        expect(locationAssign).toHaveBeenCalledWith(STORE_URL.ios)
    })

    it('ignores a querystring with neither the marker nor a campaign', () => {
        mockDeviceType = 'ios'
        visit('?lang=es')
        renderPage()
        expect(locationReplace).toHaveBeenCalledWith(STORE_URL.ios)
    })

    it('shows both stores on desktop and never redirects', () => {
        renderPage()
        expect(locationReplace).not.toHaveBeenCalled()
        expect(screen.getAllByRole('button')).toHaveLength(2)
    })

    it('inside the app, applies the payload and routes to its destination', () => {
        mockNative = true
        mockApplyDeferredPayload.mockReturnValue({ dest: '/send', locale: null })
        visit(`?${PAYLOAD}`)
        renderPage()
        expect(mockApplyDeferredPayload).toHaveBeenCalledWith(expect.objectContaining({ invite: 'ABC123' }))
        expect(mockReplace).toHaveBeenCalledWith('/send')
        expect(locationReplace).not.toHaveBeenCalled()
    })

    it('inside the app with no payload, still goes home', () => {
        mockNative = true
        renderPage()
        expect(mockApplyDeferredPayload).not.toHaveBeenCalled()
        expect(mockReplace).toHaveBeenCalledWith('/home')
    })

    it('serves the store page to every web visitor', () => {
        renderPage()
        expect(mockNotFound).not.toHaveBeenCalled()
        expect(storeButton(/app store/i)).toBeInTheDocument()
    })
})

const MARKETING_QUERY =
    '?marketing_qr=home-hero-en&qr_analytics=allow&utm_source=google&utm_medium=cpc&utm_campaign=accounts-launch'

describe('registered marketing QR handoff', () => {
    it('builds an Android campaign payload before redirect and excludes ambient functional campaigns', () => {
        mockDeviceType = 'android'
        stashInvite('alice', EInviteType.DIRECT)
        saveToCookie('campaignTag', 'unrelated-badge')
        visit(MARKETING_QUERY)
        renderPage()
        expect(locationReplace).toHaveBeenCalledTimes(1)
        const storeUrl = new URL(locationReplace.mock.calls[0][0])
        const referrer = storeUrl.searchParams.get('referrer')!
        const payload = parseDeferredPayload(referrer)!
        expect(payload).toMatchObject({ dest: '/home', lang: 'en' })
        expect(payload.attribution?.firstTouch).toMatchObject({ utmSource: 'google', utmCampaign: 'accounts-launch' })
        expect(new URLSearchParams(referrer).get('utm_campaign')).toBe('accounts-launch')
        expect(payload.invite).toBeUndefined()
        expect(payload.badgeCampaigns).toBeUndefined()
        expect(referrer).not.toContain('marketing_qr')
    })

    it('keeps iOS on the user-tap path and writes only the scanner handoff', () => {
        mockDeviceType = 'ios'
        visit(MARKETING_QUERY)
        renderPage()
        expect(locationReplace).not.toHaveBeenCalled()
        fireEvent.click(storeButton(/app store/i))
        const payload = parseDeferredPayload(mockCopyIOSHandoff.mock.calls[0][0])!
        expect(payload.dest).toBe('/home')
        expect(payload.attribution?.firstTouch.utmCampaign).toBe('accounts-launch')
        expect(locationAssign).toHaveBeenCalledWith(STORE_URL.ios)
    })

    it.each(['deny-marker', 'current-opt-out'] as const)(
        'does not create marketing attribution when denied by %s',
        (reason) => {
            mockDeviceType = 'android'
            mockAnalyticsAllowed = reason !== 'current-opt-out'
            visit(reason === 'deny-marker' ? MARKETING_QUERY.replace('allow', 'deny') : MARKETING_QUERY)
            renderPage()
            expect(locationReplace).toHaveBeenCalledWith(STORE_URL.android)
            expect(readSignupAttribution()).toBeNull()
            expect(mockCopyIOSHandoff).not.toHaveBeenCalled()
        }
    )

    it.each(['user@example.com', 'a'.repeat(65)])(
        'does not capture malformed content on a direct app marker: %s',
        (content) => {
            mockDeviceType = 'android'
            visit(`${MARKETING_QUERY}&utm_content=${encodeURIComponent(content)}`)
            renderPage()
            expect(locationReplace).toHaveBeenCalledWith(STORE_URL.android)
            expect(readSignupAttribution()).toBeNull()
            expect(mockCopyIOSHandoff).not.toHaveBeenCalled()
        }
    )

    it('keeps a scanner’s earlier first touch while recording the marketing campaign as the last touch', () => {
        const firstTouch = {
            occurredAt: new Date().toISOString(),
            utmSource: 'twitter',
            utmMedium: 'social',
            utmCampaign: 'first-visit',
            path: '/',
        }
        saveToCookie('signupAttribution', {
            schemaVersion: '1',
            journeyId: '8c7ea260-78f2-4e88-b83a-b423c5779854',
            platform: 'web',
            analyticsState: 'enabled',
            captureMethod: 'browser',
            firstTouch,
        })
        visit(MARKETING_QUERY)
        renderPage()
        expect(readSignupAttribution()?.firstTouch).toEqual(firstTouch)
        expect(readSignupAttribution()?.lastTouch?.utmCampaign).toBe('accounts-launch')
    })
})

const AD_QUERY = '?utm_source=twitter&utm_medium=cpm&utm_campaign=launch-films-ar'

function loadedDocument(pathname: string, referrer: string) {
    Object.defineProperty(document, 'referrer', { configurable: true, value: referrer })
    Object.defineProperty(performance, 'getEntriesByType', {
        configurable: true,
        value: () => [{ name: `https://peanut.me${pathname}` }],
    })
}

describe('ad landing link (/app with campaign parameters)', () => {
    afterEach(() => {
        Object.defineProperty(document, 'referrer', { configurable: true, value: '' })
        Object.defineProperty(performance, 'getEntriesByType', { configurable: true, value: () => [] })
    })

    it('bounces Android to Play with the marker, the campaign and the journey in the referrer', () => {
        mockDeviceType = 'android'
        visit(AD_QUERY)
        renderPage()
        expect(locationReplace).toHaveBeenCalledTimes(1)
        expect(locationReplace.mock.calls[0][0].startsWith(`${STORE_URL.android}&referrer=`)).toBe(true)
        const referrer = new URL(locationReplace.mock.calls[0][0]).searchParams.get('referrer')!
        expect(new URLSearchParams(referrer).get('pnutdl')).toBe('1')
        expect(new URLSearchParams(referrer).get('utm_medium')).toBe('cpm')
        expect(new URLSearchParams(referrer).get('utm_campaign')).toBe('launch-films-ar')
        const payload = parseDeferredPayload(referrer)!
        expect(payload.dest).toBeUndefined()
        expect(payload.attribution?.firstTouch).toMatchObject({
            utmSource: 'twitter',
            utmMedium: 'cpm',
            utmCampaign: 'launch-films-ar',
        })
        expect(payload.attribution?.journeyId).toBe(readSignupAttribution()?.journeyId)
        expect(mockTrackHandoffCreated).toHaveBeenCalledTimes(1)
        expect(mockTrackHandoffCreated).toHaveBeenCalledWith('android')
    })

    it('waits for the iOS tap, then writes the clipboard hand-off with the campaign', () => {
        mockDeviceType = 'ios'
        visit(AD_QUERY)
        renderPage()
        expect(locationReplace).not.toHaveBeenCalled()
        fireEvent.click(storeButton(/app store/i))
        expect(mockCopyIOSHandoff).toHaveBeenCalledTimes(1)
        const payload = parseDeferredPayload(mockCopyIOSHandoff.mock.calls[0][0])!
        expect(payload.dest).toBeUndefined()
        expect(payload.attribution?.firstTouch).toMatchObject({ utmSource: 'twitter', utmCampaign: 'launch-films-ar' })
        expect(trackStoreClick).toHaveBeenCalledWith('ios', 'smart_link', true)
        expect(locationAssign).toHaveBeenCalledWith(STORE_URL.ios)
    })

    it('treats an external referrer on the loaded page as a campaign', () => {
        mockDeviceType = 'android'
        loadedDocument('/app', 'https://t.co/abc')
        visit('')
        // instrumentation-client records the document referrer before React mounts
        captureSignupAttribution({ includeDocumentReferrer: true })
        renderPage()
        const referrer = new URL(locationReplace.mock.calls[0][0]).searchParams.get('referrer')!
        expect(parseDeferredPayload(referrer)?.attribution?.firstTouch.referrerHost).toBe('t.co')
    })

    it('ignores a referrer left over from the page the visitor loaded before navigating here', () => {
        mockDeviceType = 'ios'
        loadedDocument('/es-ar', 'https://t.co/abc')
        visit('')
        renderPage()
        expect(locationReplace).toHaveBeenCalledWith(STORE_URL.ios)
        expect(readSignupAttribution()).toBeNull()
    })

    it.each(['android', 'ios'])('builds no attribution on %s when analytics consent is off', (device) => {
        mockDeviceType = device
        mockAnalyticsAllowed = false
        visit(AD_QUERY)
        renderPage()
        expect(locationReplace).toHaveBeenCalledWith(STORE_URL[device as 'android' | 'ios'])
        expect(readSignupAttribution()).toBeNull()
        expect(mockTrackHandoffCreated).not.toHaveBeenCalled()
    })

    it('keeps the marked payload as given when it also carries campaign parameters', () => {
        mockDeviceType = 'android'
        visit(`?${PAYLOAD}&utm_source=twitter`)
        renderPage()
        expect(locationReplace).toHaveBeenCalledWith(
            `${STORE_URL.android}&referrer=${encodeURIComponent(`${PAYLOAD}&utm_source=twitter`)}`
        )
        expect(readSignupAttribution()).toBeNull()
    })

    it('inside the app, goes home without building a hand-off', () => {
        mockNative = true
        visit(AD_QUERY)
        renderPage()
        expect(mockReplace).toHaveBeenCalledWith('/home')
        expect(readSignupAttribution()).toBeNull()
    })
})

describe('validated acquisition bootstrap before navigation', () => {
    const link: ResolvedAcquisitionLink = {
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
    afterEach(() => {
        jest.useRealTimers()
        Object.defineProperty(document, 'prerendering', { configurable: true, value: false })
    })
    it('does not let Android auto-navigation outrun inviter bootstrap', async () => {
        let finish!: (value: { status: 200; link: ResolvedAcquisitionLink }) => void
        jest.mocked(resolveAcquisitionLinkClient).mockImplementation(
            () =>
                new Promise((resolve) => {
                    finish = resolve
                })
        )
        mockDeviceType = 'android'
        visit('?tl=alice&tr=1')
        renderPage()
        expect(locationReplace).not.toHaveBeenCalled()
        await act(async () => {
            finish({ status: 200, link })
        })
        await waitFor(() => expect(locationReplace).toHaveBeenCalledTimes(1))
        const payload = new URL(locationReplace.mock.calls[0][0]).searchParams.get('referrer')!
        expect(parseDeferredPayload(payload)?.acquisitionInvite).toBe('alice')
        expect(parseDeferredPayload(payload)?.invite).toBeUndefined()
    })
    it('holds iOS for the clipboard gesture, and offers the existing app association', async () => {
        jest.mocked(resolveAcquisitionLinkClient).mockResolvedValue({ status: 200, link })
        mockDeviceType = 'ios'
        visit('?tl=alice&tr=1')
        renderPage()
        await waitFor(() => expect(screen.getByRole('link', { name: 'Open Peanut' })).toBeInTheDocument())
        expect(locationReplace).not.toHaveBeenCalled()
        expect(mockCopyIOSHandoff).not.toHaveBeenCalled()
        const openApp = new URL(screen.getByRole('link', { name: 'Open Peanut' }).getAttribute('href')!)
        expect(openApp.origin).toBe('https://peanut.me')
        expect(openApp.pathname).toBe('/home')
        expect(openApp.searchParams.get('tl_seen')).toBe('1')
        fireEvent.click(storeButton(/app store/i))
        expect(parseDeferredPayload(mockCopyIOSHandoff.mock.calls[0][0])?.acquisitionInvite).toBe('alice')
    })
    it('keeps passive handoff functional while denying existing store and handoff telemetry', async () => {
        mockAnalyticsAllowed = false
        jest.mocked(resolveAcquisitionLinkClient).mockResolvedValue({ status: 200, link })
        mockDeviceType = 'ios'
        visit('?tl=alice')
        renderPage()
        await waitFor(() => expect(screen.getByRole('link', { name: 'Open Peanut' })).toBeInTheDocument())
        fireEvent.click(storeButton(/app store/i))
        await act(async () => {})
        expect(parseDeferredPayload(mockCopyIOSHandoff.mock.calls[0][0])?.acquisitionInvite).toBe('alice')
        expect(trackStoreClick).not.toHaveBeenCalled()
        expect(mockTrackHandoffCreated).not.toHaveBeenCalled()
    })
    it('waits for prerender activation before descriptor bootstrap or store navigation', async () => {
        Object.defineProperty(document, 'prerendering', { configurable: true, value: true })
        jest.mocked(resolveAcquisitionLinkClient).mockResolvedValue({ status: 200, link })
        mockDeviceType = 'android'
        visit('?tl=alice')
        renderPage()
        expect(resolveAcquisitionLinkClient).not.toHaveBeenCalled()
        expect(locationReplace).not.toHaveBeenCalled()
        await act(async () => {
            Object.defineProperty(document, 'prerendering', { configurable: true, value: false })
            document.dispatchEvent(new Event('prerenderingchange'))
        })
        await waitFor(() => expect(locationReplace).toHaveBeenCalledTimes(1))
    })
    it('reaches the normal store after the bounded deadline when bootstrap stalls', async () => {
        jest.useFakeTimers()
        jest.mocked(resolveAcquisitionLinkClient).mockReturnValue(new Promise(() => {}))
        mockDeviceType = 'android'
        visit('?tl=alice')
        renderPage()
        await act(async () => {
            jest.advanceTimersByTime(3000)
        })
        expect(locationReplace).toHaveBeenCalledWith(STORE_URL.android)
    })
})
