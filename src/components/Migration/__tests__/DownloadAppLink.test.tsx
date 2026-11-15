/** @jest-environment jsdom */
jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

/**
 * The landing hero and sticky "Download now" CTA must reach the store in one
 * tap on a phone and hand off the ad campaign: Android through the Play
 * referrer on the link itself, iOS through a clipboard write inside the tap.
 */
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { MIGRATION_SURFACES, STORE_URL } from '@/constants/migration.consts'
import { parseDeferredPayload } from '@/utils/deferred-link'
import { captureSignupAttribution } from '@/utils/signup-attribution'

let mockDeviceType = 'web'
jest.mock('@/hooks/useGetDeviceType', () => ({
    ...jest.requireActual('@/hooks/useGetDeviceType'),
    useDeviceType: () => ({ deviceType: mockDeviceType }),
}))

jest.mock('posthog-js', () => ({ capture: jest.fn() }))

jest.mock('@/utils/capacitor', () => ({
    isNativeBridge: () => false,
    isCapacitor: () => false,
    isAndroidNative: () => false,
    isIOSNative: () => false,
    openExternalUrl: jest.fn(),
}))

const mockIntercept = jest.fn(() => true)
jest.mock('@/components/Migration/AppModalProvider', () => ({ useAppModal: () => mockIntercept }))

const mockCopyIOSHandoff = jest.fn().mockResolvedValue(undefined)
const mockTrackHandoffCreated = jest.fn()
jest.mock('@/utils/deferred-link', () => ({
    ...jest.requireActual('@/utils/deferred-link'),
    copyIOSHandoff: (...args: unknown[]) => mockCopyIOSHandoff(...args),
    trackDeferredHandoffCreated: (...args: unknown[]) => mockTrackHandoffCreated(...args),
}))

import DownloadAppLink from '../DownloadAppLink'

function visit(search: string) {
    window.history.replaceState(null, '', `/es-ar${search}`)
}

const renderLink = () =>
    render(<DownloadAppLink surface={MIGRATION_SURFACES.LANDING_HERO} qrPlacement="hero" />, {
        wrapper: IntlWrapper,
    })

beforeEach(() => {
    jest.clearAllMocks()
    for (const cookie of document.cookie.split(';')) {
        document.cookie = `${cookie.split('=')[0].trim()}=; Max-Age=0; path=/`
    }
    visit('?utm_source=twitter&utm_medium=cpm&utm_campaign=launch-films-ar')
    captureSignupAttribution()
})

it('links Android straight to Play with the campaign in the referrer', () => {
    mockDeviceType = 'android'
    renderLink()
    const link = screen.getByRole('link')
    const href = link.getAttribute('href')!
    expect(href.startsWith(`${STORE_URL.android}&referrer=`)).toBe(true)
    const payload = parseDeferredPayload(new URL(href).searchParams.get('referrer')!)!
    expect(payload.lang).toBe('es-ar')
    expect(payload.attribution?.firstTouch).toMatchObject({ utmSource: 'twitter', utmCampaign: 'launch-films-ar' })
    fireEvent.click(link)
    expect(mockIntercept).not.toHaveBeenCalled()
    expect(mockTrackHandoffCreated).toHaveBeenCalledWith('android')
})

it('links iOS straight to the App Store and writes the campaign hand-off in the same tap', () => {
    mockDeviceType = 'ios'
    renderLink()
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', STORE_URL.ios)
    fireEvent.click(link)
    expect(mockIntercept).not.toHaveBeenCalled()
    expect(mockCopyIOSHandoff).toHaveBeenCalledTimes(1)
    const payload = parseDeferredPayload(mockCopyIOSHandoff.mock.calls[0][0])!
    expect(payload.attribution?.firstTouch).toMatchObject({ utmSource: 'twitter', utmCampaign: 'launch-films-ar' })
})

it('leaves desktop on the QR modal', () => {
    mockDeviceType = 'web'
    renderLink()
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/app')
    fireEvent.click(link)
    expect(mockIntercept).toHaveBeenCalledWith(MIGRATION_SURFACES.LANDING_HERO, 'hero')
    expect(mockCopyIOSHandoff).not.toHaveBeenCalled()
})
