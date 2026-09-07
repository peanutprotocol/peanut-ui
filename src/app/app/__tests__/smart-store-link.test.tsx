/** @jest-environment jsdom */
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

let mockDeviceType = 'web'
jest.mock('@/hooks/useGetDeviceType', () => ({
    ...jest.requireActual('@/hooks/useGetDeviceType'),
    useDeviceType: () => ({ deviceType: mockDeviceType }),
}))

const mockReplace = jest.fn()
const mockNotFound = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ replace: mockReplace }),
    notFound: () => mockNotFound(),
}))

// flags land immediately: the page waits for this callback (or a 4s timeout)
// before it is willing to 404
jest.mock('posthog-js', () => ({
    capture: jest.fn(),
    onFeatureFlags: jest.fn((cb: () => void) => {
        cb()
        return jest.fn()
    }),
}))

let mockNative = false
jest.mock('@/utils/capacitor', () => ({
    isNativeBridge: () => mockNative,
    isCapacitor: () => mockNative,
    isAndroidNative: () => false,
    isIOSNative: () => false,
    openExternalUrl: jest.fn(),
}))

let mockFlagOn = true
jest.mock('@/utils/migration.utils', () => ({
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

function visit(search: string) {
    Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
            origin: 'https://peanut.me',
            pathname: '/app',
            search,
            href: `https://peanut.me/app${search}`,
            replace: locationReplace,
        },
    })
}

const renderPage = () => render(<SmartStoreRedirect />, { wrapper: IntlWrapper })
const link = (name: RegExp) => screen.getByRole('link', { name })

beforeEach(() => {
    jest.clearAllMocks()
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
        visit(`?${PAYLOAD}&s=landing_hero`)
        renderPage()
        // the surface tag is ours, not the app's — it must not ride along
        expect(locationReplace).toHaveBeenCalledWith(`${STORE_URL.android}&referrer=${encodeURIComponent(PAYLOAD)}`)
        expect(mockTrackHandoffCreated).toHaveBeenCalledWith('android')
    })

    it('never auto-redirects iOS with a payload — the clipboard needs the tap', () => {
        mockDeviceType = 'ios'
        visit(`?${PAYLOAD}`)
        renderPage()
        expect(locationReplace).not.toHaveBeenCalled()
        expect(link(/app store/i)).toHaveAttribute('href', STORE_URL.ios)
        expect(link(/google play/i)).toBeInTheDocument()

        fireEvent.click(link(/app store/i))
        expect(mockCopyIOSHandoff).toHaveBeenCalledWith(PAYLOAD)
        expect(trackStoreClick).toHaveBeenCalledWith('ios', 'smart_link', true)
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
        expect(screen.getAllByRole('link')).toHaveLength(2)
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
