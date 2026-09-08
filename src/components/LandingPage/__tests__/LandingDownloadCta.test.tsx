import { fireEvent, render, screen } from '@testing-library/react'
import { LandingDownloadCta } from '../LandingDownloadCta'
import { FooterStoreLinks } from '../FooterStoreLinks'
import { StickyMobileCTA } from '../StickyMobileCTA'
import type { LandingStrings } from '../landingStrings'
import { STORE_URL } from '@/constants/migration.consts'

let mockDevice = 'web'
let mockMigration = true
const mockTrackStoreClick = jest.fn()
jest.mock('@/utils/migration.utils', () => ({
    trackStoreClick: (...args: unknown[]) => mockTrackStoreClick(...args),
    storeAnchorHref: () => '/store',
    onStoreAnchorClick: jest.fn(),
}))
const mockIntercept = jest.fn(() => true)
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/hooks/useGetDeviceType', () => ({
    DeviceType: { WEB: 'web', IOS: 'ios', ANDROID: 'android' },
    useDeviceType: () => ({ deviceType: mockDevice }),
}))
jest.mock('@/hooks/useMigrationFlag', () => ({ useMigrationFlag: () => mockMigration }))
jest.mock('@/components/Migration/AppModalProvider', () => ({ useAppModal: () => mockIntercept }))
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

beforeEach(() => {
    mockDevice = 'web'
    mockMigration = true
    mockIntercept.mockClear()
    mockTrackStoreClick.mockClear()
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
})

it('has one desktop download action and delegates to the shared modal', () => {
    render(<LandingDownloadCta subtext="Join us" />)
    expect(screen.getAllByRole('link')).toHaveLength(1)
    const link = screen.getByRole('link', { name: 'downloadNow' })
    expect(link).toHaveAttribute('href', '/app')
    fireEvent.click(link)
    expect(mockIntercept).toHaveBeenCalledWith('landing_hero')
})
it.each(['ios', 'android'])('has one store download action on %s', (device) => {
    mockDevice = device
    render(<LandingDownloadCta />)
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'downloadNow' })).toHaveAttribute(
        'href',
        STORE_URL[device as 'ios' | 'android']
    )
})
it.each(['ios', 'android'])('tracks the %s footer store link without changing its destination', (store) => {
    render(<FooterStoreLinks />)
    const link = screen.getByRole('link', { name: store === 'ios' ? 'App Store' : 'Google Play' })
    expect(link).toHaveAttribute('href', STORE_URL[store as 'ios' | 'android'])
    fireEvent.click(link)
    expect(mockTrackStoreClick).toHaveBeenCalledWith(store, 'landing_footer')
})

it('hides footer stores while migration is off', () => {
    mockMigration = false
    render(<FooterStoreLinks />)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
    expect(mockTrackStoreClick).not.toHaveBeenCalled()
})

it('offers only the store download in the sticky bar while migration is on', () => {
    mockDevice = 'ios'
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 400 })
    render(<StickyMobileCTA strings={{ logIn: 'Log in' } as LandingStrings} />)
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'downloadNow' })).toHaveAttribute('href', '/store')
})
