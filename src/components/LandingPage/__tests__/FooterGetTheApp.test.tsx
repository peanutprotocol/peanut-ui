import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { FooterGetTheApp } from '../FooterGetTheApp'
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
}))
jest.mock('@/components/Global/QRCodeWrapper', () => ({
    __esModule: true,
    default: ({ url }: { url: string }) => <div data-testid="qr">{url}</div>,
}))

describe('FooterGetTheApp', () => {
    beforeEach(() => {
        mockMigrationOn.mockReturnValue(true)
        mockDeviceType.mockReturnValue(DeviceType.WEB)
    })

    it('renders nothing with the flag off, so today’s footer is untouched', () => {
        mockMigrationOn.mockReturnValue(false)
        const { container } = renderWithIntl(<FooterGetTheApp />)
        expect(container).toBeEmptyDOMElement()
    })

    it('gives a laptop the QR and the store pair, tagged as the footer', () => {
        renderWithIntl(<FooterGetTheApp />)
        expect(screen.getByText('Get the Peanut app')).toBeInTheDocument()
        expect(screen.getByTestId('qr')).toHaveTextContent('/app?pnutdl=1&s=landing_footer')
        expect(screen.getByRole('link', { name: /app store/i })).toHaveAttribute('href', 'https://store.example/ios')
        expect(screen.getByRole('link', { name: /google play/i })).toHaveAttribute(
            'href',
            'https://store.example/android'
        )
    })

    it('gives a phone one button and no QR it could not scan', () => {
        mockDeviceType.mockReturnValue(DeviceType.IOS)
        renderWithIntl(<FooterGetTheApp />)
        expect(screen.getByRole('link', { name: /download now/i })).toHaveAttribute('href', 'https://store.example/ios')
        expect(screen.queryByRole('link', { name: /google play/i })).not.toBeInTheDocument()
        expect(screen.queryByTestId('qr')).not.toBeInTheDocument()
    })
})
