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
import { fireEvent, render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { STORE_URL } from '@/constants/migration.consts'
import { parseDeferredPayload } from '@/utils/deferred-link'
import { readSignupAttribution } from '@/utils/signup-attribution'
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

jest.mock('posthog-js', () => ({ capture: jest.fn() }))

let mockNative = false
jest.mock('@/utils/capacitor', () => ({
    isNativeBridge: () => mockNative,
    isCapacitor: () => false,
    isAndroidNative: () => false,
    isIOSNative: () => false,
    openExternalUrl: jest.fn(),
}))

let mockFlagOn = true
jest.mock('@/utils/migration.utils', () => ({
    storeForDevice: jest.requireActual('@/utils/migration.utils').storeForDevice,
    storeIcon: jest.requireActual('@/utils/migration.utils').storeIcon,
    isPwaSunsetOn: () => mockFlagOn,
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
    mockFlagOn = true
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

    it('ignores a querystring without the marker', () => {
        mockDeviceType = 'ios'
        visit('?utm_source=newsletter')
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

    it('404s while the flag is off', () => {
        mockFlagOn = false
        renderPage()
        expect(mockNotFound).toHaveBeenCalled()
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

    it('keeps old marketing QR URLs usable where web signup is open', () => {
        mockFlagOn = false
        visit(MARKETING_QUERY)
        renderPage()
        expect(mockNotFound).not.toHaveBeenCalled()
        expect(storeButton(/app store/i)).toBeInTheDocument()
        expect(storeButton(/google play/i)).toBeInTheDocument()
        expect(locationReplace).not.toHaveBeenCalled()
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

    it('does not make an unknown registration bypass generic app behavior', () => {
        mockFlagOn = false
        visit(MARKETING_QUERY.replace('home-hero-en', 'payment-link'))
        renderPage()
        expect(mockNotFound).toHaveBeenCalled()
        expect(locationReplace).not.toHaveBeenCalled()
    })

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
