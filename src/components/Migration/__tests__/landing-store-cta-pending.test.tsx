/** @jest-environment jsdom */
jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

/**
 * PostHog needs a few seconds to return flags on a first visit. Ad visitors
 * tap within that window, so a phone must already get the one-tap store CTA
 * instead of web signup.
 */
import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { MIGRATION_SURFACES, STORE_URL } from '@/constants/migration.consts'
import { LandingAppLink } from '@/components/LandingPage/LandingAppLink'
import { AppModalProvider } from '@/components/Migration/AppModalProvider'
import { LandingDownloadCta } from '@/components/LandingPage/LandingDownloadCta'
import { useLandingStoreCta } from '@/hooks/useLandingStoreCta'
import { parseDeferredPayload } from '@/utils/deferred-link'
import { captureSignupAttribution } from '@/utils/signup-attribution'

jest.mock('posthog-js', () => {
    const posthog = {
        __loaded: true,
        featureFlags: { hasLoadedFlags: false },
        flagOn: false,
        listeners: [] as Array<() => void>,
        isFeatureEnabled: () => (posthog.featureFlags.hasLoadedFlags ? posthog.flagOn : undefined),
        onFeatureFlags: (listener: () => void) => {
            posthog.listeners.push(listener)
            return () => {}
        },
        capture: () => {},
        _isIdentified: () => false,
        get_distinct_id: () => 'not-a-uuid',
    }
    return posthog
})
const mockPosthog = jest.requireMock('posthog-js') as {
    __loaded: boolean
    featureFlags: { hasLoadedFlags: boolean }
    flagOn: boolean
    listeners: Array<() => void>
}

let mockDeviceType = 'web'
jest.mock('@/hooks/useGetDeviceType', () => ({
    ...jest.requireActual('@/hooks/useGetDeviceType'),
    useDeviceType: () => ({ deviceType: mockDeviceType }),
}))

const mockOpenExternalUrl = jest.fn()
jest.mock('@/utils/capacitor', () => ({
    ...jest.requireActual('@/utils/capacitor'),
    isCapacitor: () => false,
    isNativeBridge: () => false,
    openExternalUrl: (...args: unknown[]) => mockOpenExternalUrl(...args),
}))

const mockCopyIOSHandoff = jest.fn().mockResolvedValue(undefined)
jest.mock('@/utils/deferred-link', () => ({
    ...jest.requireActual('@/utils/deferred-link'),
    copyIOSHandoff: (...args: unknown[]) => mockCopyIOSHandoff(...args),
}))

function loadFlags(on: boolean) {
    mockPosthog.featureFlags.hasLoadedFlags = true
    mockPosthog.flagOn = on
    act(() => mockPosthog.listeners.forEach((listener) => listener()))
}

function StoreCtaProbe() {
    return <span data-testid="store-cta">{String(useLandingStoreCta())}</span>
}

const renderFoldCta = () =>
    render(
        <AppModalProvider marketingPage="home">
            <LandingAppLink href="/setup" surface={MIGRATION_SURFACES.LANDING_APP_FOLD}>
                Crear cuenta
            </LandingAppLink>
        </AppModalProvider>,
        { wrapper: IntlWrapper }
    )

beforeEach(() => {
    jest.clearAllMocks()
    mockPosthog.listeners.length = 0
    mockPosthog.__loaded = true
    mockPosthog.featureFlags.hasLoadedFlags = false
    mockPosthog.flagOn = false
    for (const cookie of document.cookie.split(';')) {
        document.cookie = `${cookie.split('=')[0].trim()}=; Max-Age=0; path=/`
    }
    window.history.replaceState(null, '', '/es-ar?utm_source=twitter&utm_medium=cpm&utm_campaign=launch-films-ar')
    captureSignupAttribution()
})

describe('landing store CTA while flags load', () => {
    it.each(['ios', 'android'])('is on for %s before PostHog answers', (device) => {
        mockDeviceType = device
        render(<StoreCtaProbe />)
        expect(screen.getByTestId('store-cta')).toHaveTextContent('true')
    })

    it('waits for the flag on desktop', () => {
        mockDeviceType = 'web'
        render(<StoreCtaProbe />)
        expect(screen.getByTestId('store-cta')).toHaveTextContent('false')
        loadFlags(true)
        expect(screen.getByTestId('store-cta')).toHaveTextContent('true')
    })

    it('returns to web signup when the flag loads off', () => {
        mockDeviceType = 'ios'
        render(<StoreCtaProbe />)
        loadFlags(false)
        expect(screen.getByTestId('store-cta')).toHaveTextContent('false')
    })

    it('stays off where PostHog never starts', () => {
        mockDeviceType = 'ios'
        mockPosthog.__loaded = false
        render(<StoreCtaProbe />)
        expect(screen.getByTestId('store-cta')).toHaveTextContent('false')
    })

    it('gives Android the Play link with the campaign before flags load', () => {
        mockDeviceType = 'android'
        render(<LandingDownloadCta />, { wrapper: IntlWrapper })
        const href = screen.getByRole('link').getAttribute('href')!
        expect(href.startsWith(`${STORE_URL.android}&referrer=`)).toBe(true)
        const payload = parseDeferredPayload(new URL(href).searchParams.get('referrer')!)!
        expect(payload.attribution?.firstTouch).toMatchObject({ utmCampaign: 'launch-films-ar' })
    })

    it('sends an iOS fold tap to the App Store with the clipboard hand-off before flags load', () => {
        mockDeviceType = 'ios'
        renderFoldCta()
        const link = screen.getByRole('link', { name: 'Crear cuenta' })
        expect(fireEvent.click(link)).toBe(false)
        expect(mockCopyIOSHandoff).toHaveBeenCalledTimes(1)
        const payload = parseDeferredPayload(mockCopyIOSHandoff.mock.calls[0][0])!
        expect(payload.attribution?.firstTouch).toMatchObject({ utmSource: 'twitter', utmCampaign: 'launch-films-ar' })
        expect(mockOpenExternalUrl).toHaveBeenCalledWith(STORE_URL.ios)
    })

    it('leaves a desktop fold tap on its link before flags load', () => {
        mockDeviceType = 'web'
        renderFoldCta()
        expect(fireEvent.click(screen.getByRole('link', { name: 'Crear cuenta' }))).toBe(true)
        expect(mockOpenExternalUrl).not.toHaveBeenCalled()
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
})
