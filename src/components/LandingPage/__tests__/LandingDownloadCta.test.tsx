import { fireEvent, render, screen } from '@testing-library/react'
import { LandingDownloadCta } from '../LandingDownloadCta'
import { FooterStoreLinks } from '../FooterStoreLinks'
import { StickyMobileCTA } from '../StickyMobileCTA'
let mockDevice = 'web'
const mockStoreAnchorHref = jest.fn((_store: string) => '/store')
const mockOnStoreAnchorClick = jest.fn()
jest.mock('@/utils/migration.utils', () => ({
    storeForDevice: jest.requireActual('@/utils/migration.utils').storeForDevice,
    storeIcon: jest.requireActual('@/utils/migration.utils').storeIcon,
    storeAnchorHref: (store: string) => mockStoreAnchorHref(store),
    onStoreAnchorClick: (...args: unknown[]) => mockOnStoreAnchorClick(...args),
}))
const mockIntercept = jest.fn(() => true)
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/hooks/useGetDeviceType', () => ({
    DeviceType: { WEB: 'web', IOS: 'ios', ANDROID: 'android' },
    useDeviceType: () => ({ deviceType: mockDevice }),
}))
jest.mock('@/components/Migration/AppModalProvider', () => ({ useAppModal: () => mockIntercept }))
// link mode renders the anchor itself; keep only what these tests read
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({
        children,
        icon,
        href,
        onClick,
    }: {
        children: React.ReactNode
        icon?: string
        href?: string
        onClick?: React.MouseEventHandler<HTMLAnchorElement>
    }) =>
        href !== undefined ? (
            <a href={href} onClick={onClick} data-icon={icon}>
                {children}
            </a>
        ) : (
            <span data-icon={icon}>{children}</span>
        ),
}))

beforeEach(() => {
    mockDevice = 'web'
    mockIntercept.mockClear()
    mockOnStoreAnchorClick.mockClear()
    mockStoreAnchorHref.mockImplementation(() => '/store')
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
})

it('has one desktop download action and delegates to the shared modal', () => {
    render(<LandingDownloadCta subtext="Join us" />)
    expect(screen.getAllByRole('link')).toHaveLength(1)
    const link = screen.getByRole('link', { name: 'downloadNow' })
    expect(link).toHaveAttribute('href', '/app')
    fireEvent.click(link)
    expect(mockIntercept).toHaveBeenCalledWith('landing_hero', 'hero')
})
it.each(['ios', 'android'])('has one store download action on %s', (device) => {
    mockDevice = device
    render(<LandingDownloadCta />)
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'downloadNow' })).toHaveAttribute('href', '/store')
})
it.each([
    ['web', 'qr-code'],
    ['ios', 'apple-logo'],
    ['android', 'google-play'],
])('the hero and the sticky bar show the same icon on %s', (device, icon) => {
    mockDevice = device
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 400 })
    render(
        <>
            <LandingDownloadCta />
            <StickyMobileCTA />
        </>
    )
    const icons = screen.getAllByText('downloadNow').map((el) => el.getAttribute('data-icon'))
    expect(icons).toEqual([icon, icon])
})
it.each(['ios', 'android'])('the %s footer store link writes the deferred hand-off and tracks the footer', (store) => {
    mockStoreAnchorHref.mockImplementation((target) => `/store/${target}`)
    render(<FooterStoreLinks />)
    const link = screen.getByRole('link', { name: store === 'ios' ? 'App Store' : 'Google Play' })
    expect(link).toHaveAttribute('href', `/store/${store}`)
    fireEvent.click(link)
    expect(mockOnStoreAnchorClick).toHaveBeenCalledWith(store, 'landing_footer')
})

it('offers only the store download in the sticky bar', () => {
    mockDevice = 'ios'
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 400 })
    render(<StickyMobileCTA />)
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'downloadNow' })).toHaveAttribute('href', '/store')
})
