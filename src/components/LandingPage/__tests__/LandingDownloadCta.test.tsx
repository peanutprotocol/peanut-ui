import { fireEvent, render, screen } from '@testing-library/react'
import { LandingDownloadCta } from '../LandingDownloadCta'
import { LandingAppLink } from '../LandingAppLink'
import { STORE_URL } from '@/constants/migration.consts'

let mockDevice = 'web'
let mockMigration = true
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
})

it('has one desktop download action and delegates to the shared modal', () => {
    render(<LandingDownloadCta subtext="Join us" />)
    expect(screen.getAllByRole('link')).toHaveLength(1)
    const link = screen.getByRole('link', { name: 'downloadNow' })
    expect(link).toHaveAttribute('href', '/app')
    fireEvent.click(link)
    expect(mockIntercept).toHaveBeenCalledWith('landing_hero')
})
it.each(['ios', 'android'])('offers the opposite store on %s', (device) => {
    mockDevice = device
    render(<LandingDownloadCta />)
    expect(screen.getByRole('link', { name: 'downloadNow' })).toHaveAttribute(
        'href',
        STORE_URL[device as 'ios' | 'android']
    )
    expect(screen.getByRole('link', { name: 'otherStore' })).toHaveAttribute(
        'href',
        STORE_URL[device === 'ios' ? 'android' : 'ios']
    )
})
it('keeps web login when the flag is off and changes its fallback URL when on', () => {
    mockMigration = false
    const { rerender } = render(
        <LandingAppLink href="/setup?step=login" surface="landing_login">
            Log in
        </LandingAppLink>
    )
    expect(screen.getByRole('link')).toHaveAttribute('href', '/setup?step=login')
    mockMigration = true
    rerender(
        <LandingAppLink href="/setup?step=login" surface="landing_login">
            Log in
        </LandingAppLink>
    )
    expect(screen.getByRole('link')).toHaveAttribute('href', '/app')
    fireEvent.click(screen.getByRole('link'))
    expect(mockIntercept).toHaveBeenCalledWith('landing_login')
})

it('lets phone login follow the app link instead of intercepting it into a store bounce', () => {
    mockDevice = 'ios'
    render(
        <LandingAppLink href="/setup?step=login" surface="landing_login">
            Log in
        </LandingAppLink>
    )
    fireEvent.click(screen.getByRole('link'))
    expect(mockIntercept).not.toHaveBeenCalled()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/app/login')
})
