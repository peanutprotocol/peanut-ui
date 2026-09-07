import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { PhoneAppCta } from '../PhoneAppCta'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { DeviceType } from '@/hooks/useGetDeviceType'

const mockDeviceType = jest.fn(() => DeviceType.IOS)
const mockOnStoreAnchorClick = jest.fn()

jest.mock('@/hooks/useGetDeviceType', () => ({
    ...jest.requireActual('@/hooks/useGetDeviceType'),
    useDeviceType: () => ({ deviceType: mockDeviceType() }),
}))
jest.mock('@/utils/migration.utils', () => ({
    storeAnchorHref: (store: string) =>
        store === 'android'
            ? 'https://play.google.com/store/apps/details?id=me.peanut.wallet'
            : 'https://apps.apple.com/us/app/id6786373552',
    onStoreAnchorClick: (...args: unknown[]) => mockOnStoreAnchorClick(...args),
}))

describe('PhoneAppCta', () => {
    beforeEach(() => {
        mockDeviceType.mockReturnValue(DeviceType.IOS)
        mockOnStoreAnchorClick.mockClear()
    })

    it('upgrades the /app href to the detected store on mount', () => {
        renderWithIntl(<PhoneAppCta surface={MIGRATION_SURFACES.LANDING_HERO} />)
        expect(screen.getByRole('link', { name: /download now/i })).toHaveAttribute(
            'href',
            'https://apps.apple.com/us/app/id6786373552'
        )
    })

    it('deep-links android and reports the calling surface', () => {
        mockDeviceType.mockReturnValue(DeviceType.ANDROID)
        renderWithIntl(<PhoneAppCta surface={MIGRATION_SURFACES.LANDING_APP_FOLD} />)

        const cta = screen.getByRole('link', { name: /download now/i })
        expect(cta).toHaveAttribute('href', 'https://play.google.com/store/apps/details?id=me.peanut.wallet')

        fireEvent.click(cta)
        expect(mockOnStoreAnchorClick).toHaveBeenCalledWith('android', 'landing_app_fold')
    })

    it('renders one store button — never a row that can overflow a 320px phone', () => {
        const { container } = renderWithIntl(<PhoneAppCta surface={MIGRATION_SURFACES.LANDING_HERO} showOtherStore />)
        expect(container.querySelectorAll('button')).toHaveLength(1)
        // the second store is a text link, and /app resolves it per device
        expect(screen.getByRole('link', { name: /other store/i })).toHaveAttribute('href', '/app')
    })

    it('leaves the other-store link out where the fold does not ask for it', () => {
        renderWithIntl(<PhoneAppCta surface={MIGRATION_SURFACES.LANDING_FOOTER} />)
        expect(screen.queryByRole('link', { name: /other store/i })).not.toBeInTheDocument()
    })
})
