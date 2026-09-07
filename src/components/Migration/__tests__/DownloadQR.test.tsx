/** @jest-environment jsdom */
/**
 * DownloadQR — the one smart QR every desktop download surface renders.
 *
 * Two things are load-bearing and invisible to a screenshot: the encoded URL
 * (a dropped payload silently breaks deferred deep linking for every scan) and
 * the impression event, which only counts once the code is actually on screen —
 * the app fold and the footer render theirs far below the fold.
 */
import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'

jest.mock('posthog-js', () => ({ capture: jest.fn() }))

jest.mock('@/components/Global/QRCodeWrapper', () => ({
    __esModule: true,
    default: ({ url, className }: { url: string; className?: string }) => (
        <div data-testid="qr" data-url={url} data-class={className} />
    ),
}))

jest.mock('@/components/Migration/StorePair', () => ({
    __esModule: true,
    default: ({ surface }: { surface: string }) => <div data-testid="store-pair" data-surface={surface} />,
}))

import posthog from 'posthog-js'
import DownloadQR from '../DownloadQR'

const render_ = (ui: React.ReactElement) => render(ui, { wrapper: IntlWrapper })
const qrUrl = () => screen.getByTestId('qr').getAttribute('data-url')

// hand-driven IntersectionObserver so the impression threshold is assertable
let observerCallbacks: IntersectionObserverCallback[] = []
class FakeObserver {
    constructor(private cb: IntersectionObserverCallback) {
        observerCallbacks.push(cb)
    }
    observe() {}
    disconnect() {}
    unobserve() {}
    takeRecords() {
        return []
    }
}
const intersect = (ratio: number) =>
    act(() => {
        observerCallbacks.forEach((cb) =>
            cb(
                [{ isIntersecting: ratio > 0, intersectionRatio: ratio }] as unknown as IntersectionObserverEntry[],
                {
                    disconnect() {},
                } as unknown as IntersectionObserver
            )
        )
    })

beforeEach(() => {
    jest.clearAllMocks()
    observerCallbacks = []
    ;(globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = FakeObserver
})
afterEach(() => {
    delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver
})

describe('DownloadQR', () => {
    it('encodes /app with only the surface when there is no payload', () => {
        render_(<DownloadQR surface={MIGRATION_SURFACES.LANDING_FOOTER} />)
        expect(qrUrl()).toBe(`${window.location.origin}/app?s=landing_footer`)
    })

    it('encodes the deferred payload ahead of the surface', () => {
        render_(<DownloadQR surface={MIGRATION_SURFACES.LANDING_HERO} payload="pnutdl=1&lang=pt-br&dest=%2Fsend" />)
        expect(qrUrl()).toBe(`${window.location.origin}/app?pnutdl=1&lang=pt-br&dest=%2Fsend&s=landing_hero`)
    })

    it('renders at 160px by default and 192px when asked', () => {
        const { rerender } = render_(<DownloadQR surface={MIGRATION_SURFACES.DOWNLOAD_MODAL} />)
        expect(screen.getByTestId('qr')).toHaveAttribute('data-class', 'max-w-[160px]')
        rerender(<DownloadQR surface={MIGRATION_SURFACES.LANDING_APP_FOLD} size={192} />)
        expect(screen.getByTestId('qr')).toHaveAttribute('data-class', 'max-w-[192px]')
    })

    it('counts an impression once the code is half visible, and only once', () => {
        render_(<DownloadQR surface={MIGRATION_SURFACES.LANDING_APP_FOLD} payload="pnutdl=1" />)
        expect(posthog.capture).not.toHaveBeenCalled()

        intersect(0.2)
        expect(posthog.capture).not.toHaveBeenCalled()

        intersect(0.5)
        expect(posthog.capture).toHaveBeenCalledWith('migration_qr_shown', {
            surface: 'landing_app_fold',
            hasContext: true,
        })

        intersect(1)
        expect(posthog.capture).toHaveBeenCalledTimes(1)
    })

    it('reports hasContext false for a context-free QR', () => {
        render_(<DownloadQR surface={MIGRATION_SURFACES.SMART_LINK} />)
        intersect(1)
        expect(posthog.capture).toHaveBeenCalledWith('migration_qr_shown', {
            surface: 'smart_link',
            hasContext: false,
        })
    })

    it('falls back to counting the mount where IntersectionObserver is missing', () => {
        delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver
        render_(<DownloadQR surface={MIGRATION_SURFACES.DOWNLOAD_MODAL} />)
        expect(posthog.capture).toHaveBeenCalledWith('migration_qr_shown', {
            surface: 'download_modal',
            hasContext: false,
        })
    })
})
