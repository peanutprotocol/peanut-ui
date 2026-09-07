import { render, screen } from '@testing-library/react'
import AppQrCode from '../AppQrCode'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'

const mockCapture = jest.fn()
const mockBuildPayload = jest.fn(() => 'pnutdl=1&lang=pt-br&dest=%2Fsend')

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: (...a: unknown[]) => mockCapture(...a) } }))
jest.mock('@/utils/deferred-link', () => ({ buildDeferredPayload: () => mockBuildPayload() }))
jest.mock('@/components/Global/QRCodeWrapper', () => ({
    __esModule: true,
    default: ({ url }: { url: string }) => <div data-testid="qr">{url}</div>,
}))

describe('AppQrCode', () => {
    beforeEach(() => {
        mockCapture.mockClear()
        mockBuildPayload.mockReturnValue('pnutdl=1&lang=pt-br&dest=%2Fsend')
    })

    it('encodes /app with the deferred payload and the calling surface', () => {
        render(<AppQrCode surface={MIGRATION_SURFACES.LANDING_HERO} />)
        expect(screen.getByTestId('qr')).toHaveTextContent(
            `${window.location.origin}/app?pnutdl=1&lang=pt-br&dest=%2Fsend&s=landing_hero`
        )
    })

    it('still encodes a scannable url when the payload cannot be built', () => {
        mockBuildPayload.mockImplementation(() => {
            throw new Error('no cookies')
        })
        render(<AppQrCode surface={MIGRATION_SURFACES.LANDING_FOOTER} />)
        expect(screen.getByTestId('qr')).toHaveTextContent(`${window.location.origin}/app?s=landing_footer`)
    })

    it('reports the impression once the code is actually on screen', () => {
        // jest.setup's IntersectionObserver never fires, so nothing is counted
        // for a QR three folds below the viewport.
        const { unmount } = render(<AppQrCode surface={MIGRATION_SURFACES.LANDING_APP_FOLD} />)
        expect(mockCapture).not.toHaveBeenCalled()
        unmount()

        const observed = jest.fn()
        const realObserver = global.IntersectionObserver
        global.IntersectionObserver = class {
            constructor(private cb: IntersectionObserverCallback) {}
            observe() {
                observed()
                this.cb([{ isIntersecting: true } as IntersectionObserverEntry], this as never)
            }
            unobserve() {}
            disconnect() {}
        } as unknown as typeof IntersectionObserver

        try {
            render(<AppQrCode surface={MIGRATION_SURFACES.LANDING_APP_FOLD} />)
            expect(observed).toHaveBeenCalled()
            expect(mockCapture).toHaveBeenCalledTimes(1)
            expect(mockCapture).toHaveBeenCalledWith('migration_qr_shown', {
                surface: 'landing_app_fold',
                hasContext: true,
            })
        } finally {
            global.IntersectionObserver = realObserver
        }
    })
})
