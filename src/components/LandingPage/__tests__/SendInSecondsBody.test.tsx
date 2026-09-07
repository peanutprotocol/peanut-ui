import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { SendInSecondsBody } from '../SendInSecondsBody'
import type { LandingStrings } from '../landingStrings'
import { DeviceType } from '@/hooks/useGetDeviceType'

const mockMigrationOn = jest.fn(() => false)
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

const strings = { sendNow: 'SEND NOW' } as LandingStrings

const renderFold = () =>
    renderWithIntl(<SendInSecondsBody strings={strings} tagline="Move money worldwide." subtext="Join +10,000" />)

const hrefs = (container: HTMLElement) =>
    [...container.querySelectorAll<HTMLAnchorElement>('a[href]')].map((a) => a.getAttribute('href'))

describe('SendInSecondsBody', () => {
    beforeEach(() => {
        mockMigrationOn.mockReturnValue(false)
        mockDeviceType.mockReturnValue(DeviceType.WEB)
    })

    it('is the SEND NOW fold with the flag off', () => {
        const { container } = renderFold()
        expect(screen.getByText('SEND NOW')).toBeInTheDocument()
        expect(hrefs(container)).toContain('/send')
        // the scroll-jack still has its anchor while the flag is off
        expect(container.querySelector('#sticky-button-target')).toBeInTheDocument()
    })

    it('becomes the get-the-app fold with the flag on, with no /send left', () => {
        mockMigrationOn.mockReturnValue(true)
        const { container } = renderFold()

        expect(screen.getByText('GET THE APP.')).toBeInTheDocument()
        expect(screen.queryByText('SEND NOW')).not.toBeInTheDocument()
        expect(hrefs(container)).not.toContain('/send')
        expect(hrefs(container)).toEqual(
            expect.arrayContaining(['https://store.example/ios', 'https://store.example/android'])
        )
    })

    it('encodes the app fold surface in its QR', () => {
        mockMigrationOn.mockReturnValue(true)
        renderFold()
        expect(screen.getByTestId('qr')).toHaveTextContent('/app?pnutdl=1&s=landing_app_fold')
    })
})
