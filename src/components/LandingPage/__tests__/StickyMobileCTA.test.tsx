/** @jest-environment jsdom */
/**
 * StickyMobileCTA — the bar that slides in 300px down the landing page.
 *
 * It is `md:hidden`, so it only ever shows on a narrow viewport. That used to
 * be read as "the visitor is on a phone, and if the UA isn't Android it's an
 * iPhone" — which sent every desktop-mode Android browser to the App Store.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import type { LandingStrings } from '../landingStrings'
import { STORE_URL } from '@/constants/migration.consts'

let mockDeviceType = 'ios'
jest.mock('@/hooks/useGetDeviceType', () => ({
    ...jest.requireActual('@/hooks/useGetDeviceType'),
    useDeviceType: () => ({ deviceType: mockDeviceType }),
}))

let mockFlagOn = true
jest.mock('@/hooks/useMigrationFlag', () => ({ useMigrationFlag: () => mockFlagOn }))

jest.mock('@/utils/capacitor', () => ({
    isCapacitor: () => false,
    isAndroidNative: () => false,
    isIOSNative: () => false,
    openExternalUrl: jest.fn(),
}))

jest.mock('posthog-js', () => ({ capture: jest.fn() }))

jest.mock('@/utils/deferred-link', () => ({
    buildDeferredPayload: () => 'pnutdl=1',
    playStoreUrlWithReferrer: (payload: string) => `play://listing?referrer=${encodeURIComponent(payload)}`,
    copyIOSHandoff: jest.fn().mockResolvedValue(undefined),
    trackDeferredHandoffCreated: jest.fn(),
}))

import { StickyMobileCTA } from '../StickyMobileCTA'

const strings = { signUpNow: 'SIGN UP NOW', logIn: 'Log in' } as LandingStrings

const renderBar = () => render(<StickyMobileCTA strings={strings} />, { wrapper: IntlWrapper })

beforeEach(() => {
    jest.clearAllMocks()
    mockDeviceType = 'ios'
    mockFlagOn = true
    // the bar only mounts past 300px of scroll
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 500 })
})

describe('StickyMobileCTA during the migration', () => {
    it('deep-links the one store it can identify', () => {
        mockDeviceType = 'android'
        renderBar()
        const links = screen.getAllByRole('link')
        expect(links).toHaveLength(1)
        expect(links[0]).toHaveAttribute('href', `play://listing?referrer=${encodeURIComponent('pnutdl=1')}`)
    })

    it('offers both stores when the device is unknown (desktop-mode phone)', () => {
        mockDeviceType = 'web'
        renderBar()
        expect(screen.getByRole('link', { name: /app store/i })).toHaveAttribute('href', STORE_URL.ios)
        expect(screen.getByRole('link', { name: /google play/i })).toBeInTheDocument()
    })

    it('keeps the sign-up bar while the flag is off', () => {
        mockFlagOn = false
        mockDeviceType = 'web'
        renderBar()
        expect(screen.getByText('SIGN UP NOW')).toBeInTheDocument()
        expect(screen.queryByRole('link', { name: /app store/i })).not.toBeInTheDocument()
    })
})
