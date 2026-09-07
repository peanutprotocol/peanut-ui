/** @jest-environment jsdom */
/**
 * StorePair — the two-store button row every migration surface reuses.
 *
 * The contract that matters is the anchor: a real href (so a suppressed
 * window.open still bounces) carrying android's install referrer, plus a click
 * handler that writes the iOS clipboard hand-off inside the tap. A regression
 * here silently drops the deferred context on every download CTA at once.
 */
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MIGRATION_SURFACES, STORE_URL } from '@/constants/migration.consts'

let mockDeviceType = 'web'
jest.mock('@/hooks/useGetDeviceType', () => ({
    ...jest.requireActual('@/hooks/useGetDeviceType'),
    useDeviceType: () => ({ deviceType: mockDeviceType }),
}))

jest.mock('@/utils/capacitor', () => ({
    isCapacitor: () => false,
    isAndroidNative: () => false,
    isIOSNative: () => false,
    openExternalUrl: jest.fn(),
}))

jest.mock('posthog-js', () => ({ capture: jest.fn() }))

const mockBuildPayload = jest.fn()
const mockCopyIOSHandoff = jest.fn().mockResolvedValue(undefined)
const mockTrackHandoffCreated = jest.fn()
jest.mock('@/utils/deferred-link', () => ({
    buildDeferredPayload: (...args: unknown[]) => mockBuildPayload(...args),
    playStoreUrlWithReferrer: (payload: string) => `play://listing?referrer=${encodeURIComponent(payload)}`,
    copyIOSHandoff: (...args: unknown[]) => mockCopyIOSHandoff(...args),
    trackDeferredHandoffCreated: (...args: unknown[]) => mockTrackHandoffCreated(...args),
}))

import posthog from 'posthog-js'
import StorePair from '../StorePair'

const link = (name: RegExp) => screen.getByRole('link', { name })

beforeEach(() => {
    jest.clearAllMocks()
    mockDeviceType = 'web'
    mockBuildPayload.mockReturnValue('pnutdl=1&lang=pt-br')
})

describe('StorePair', () => {
    it('carries the install referrer on the Play href and the bare url on iOS', () => {
        render(<StorePair surface={MIGRATION_SURFACES.LANDING_HERO} />)
        expect(link(/google play/i)).toHaveAttribute(
            'href',
            `play://listing?referrer=${encodeURIComponent('pnutdl=1&lang=pt-br')}`
        )
        // iOS can't ride the url — the clipboard hand-off needs the tap
        expect(link(/app store/i)).toHaveAttribute('href', STORE_URL.ios)
    })

    it('passes the handoff context into both channels', () => {
        render(<StorePair surface={MIGRATION_SURFACES.LANDING_RATES} handoff={{ dest: '/send' }} />)
        expect(mockBuildPayload).toHaveBeenCalledWith('/send', undefined)

        mockBuildPayload.mockClear()
        fireEvent.click(link(/app store/i))
        expect(mockBuildPayload).toHaveBeenCalledWith('/send', undefined)
        expect(mockCopyIOSHandoff).toHaveBeenCalledWith('pnutdl=1&lang=pt-br')
    })

    it('reports the surface on a store tap', () => {
        render(<StorePair surface={MIGRATION_SURFACES.LANDING_FOOTER} />)
        fireEvent.click(link(/google play/i))
        expect(posthog.capture).toHaveBeenCalledWith(
            'migration_store_cta_clicked',
            expect.objectContaining({ surface: 'landing_footer', store: 'android', handoff: true })
        )
    })

    it('still bounces when the payload build throws', () => {
        mockBuildPayload.mockImplementation(() => {
            throw new Error('no cookies')
        })
        render(<StorePair surface={MIGRATION_SURFACES.SMART_LINK} />)
        expect(link(/google play/i)).toHaveAttribute('href', STORE_URL.android)
    })

    it('stacked shows only the device store, and both when it is unknown', () => {
        mockDeviceType = 'ios'
        const { rerender } = render(<StorePair surface={MIGRATION_SURFACES.DOWNLOAD_MODAL} appearance="stacked" />)
        expect(screen.getAllByRole('link')).toHaveLength(1)
        expect(link(/app store/i)).toBeInTheDocument()

        mockDeviceType = 'web'
        rerender(<StorePair surface={MIGRATION_SURFACES.DOWNLOAD_MODAL} appearance="stacked" />)
        expect(screen.getAllByRole('link')).toHaveLength(2)
    })

    it('hero anchors go full-width before they would overflow a phone', () => {
        render(<StorePair surface={MIGRATION_SURFACES.LANDING_HERO} appearance="hero" />)
        expect(link(/app store/i)).toHaveClass('w-full', 'sm:w-52')
    })
})
