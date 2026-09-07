import { render, screen } from '@testing-library/react'
import { FooterGetTheApp } from '../FooterGetTheApp'
import type { LandingMigrationStrings } from '../landingStrings'
import { DeviceType } from '@/hooks/useGetDeviceType'

const mockMigrationOn = jest.fn(() => true)
const mockDeviceType = jest.fn(() => DeviceType.WEB)

jest.mock('@/hooks/useMigrationFlag', () => ({ useMigrationFlag: () => mockMigrationOn() }))
jest.mock('@/hooks/useGetDeviceType', () => ({
    ...jest.requireActual('@/hooks/useGetDeviceType'),
    useDeviceType: () => ({ deviceType: mockDeviceType() }),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/utils/deferred-link', () => ({ buildDeferredPayload: () => 'pnutdl=1' }))
jest.mock('@/utils/migration.utils', () => ({
    storeAnchorHref: (store: string) => `https://store.example/${store}`,
    onStoreAnchorClick: jest.fn(),
    // the lockups pass this to DownloadQR to ask for the ambient deferred
    // context (locale, invite cookie) with no destination of their own
    AMBIENT_HANDOFF: {},
}))
jest.mock('@/components/Global/QRCodeWrapper', () => ({
    __esModule: true,
    default: ({ url }: { url: string }) => <div data-testid="qr">{url}</div>,
}))

// the block reads the URL locale's copy, handed down by FooterChrome, not
// next-intl's device locale — so no intl provider is needed here
const strings: LandingMigrationStrings = {
    getTheApp: 'GET THE APP.',
    qrTitle: 'Get the Peanut app',
    scanHint: 'Scan with your phone camera to download.',
    downloadNow: 'Download now',
    otherStore: 'Other store',
}

describe('FooterGetTheApp', () => {
    beforeEach(() => {
        mockMigrationOn.mockReturnValue(true)
        mockDeviceType.mockReturnValue(DeviceType.WEB)
    })

    it('renders nothing with the flag off, so today’s footer is untouched', () => {
        mockMigrationOn.mockReturnValue(false)
        const { container } = render(<FooterGetTheApp strings={strings} />)
        expect(container).toBeEmptyDOMElement()
    })

    // the QR is code-split (next/dynamic, ssr:false) so react-qr-code stays out
    // of the main chunk of every page that mounts the footer — it lands a tick
    // after the block itself
    it('gives a laptop the QR and the store pair, tagged as the footer', async () => {
        render(<FooterGetTheApp strings={strings} />)
        expect(screen.getByText('Get the Peanut app')).toBeInTheDocument()
        expect(await screen.findByTestId('qr')).toHaveTextContent('/app?pnutdl=1&s=landing_footer')
        expect(screen.getByRole('link', { name: /app store/i })).toHaveAttribute('href', 'https://store.example/ios')
        expect(screen.getByRole('link', { name: /google play/i })).toHaveAttribute(
            'href',
            'https://store.example/android'
        )
    })

    it('gives a phone one button and no QR it could not scan', () => {
        mockDeviceType.mockReturnValue(DeviceType.IOS)
        render(<FooterGetTheApp strings={strings} />)
        expect(screen.getByRole('link', { name: /download now/i })).toHaveAttribute('href', 'https://store.example/ios')
        expect(screen.queryByRole('link', { name: /google play/i })).not.toBeInTheDocument()
        expect(screen.queryByTestId('qr')).not.toBeInTheDocument()
    })
})
