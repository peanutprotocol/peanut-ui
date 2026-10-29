import { fireEvent, render, screen } from '@testing-library/react'
import { StarLpPage } from '../StarLpPage'
import { StarLpCta } from '../StarLpCta'
import { StarLpQrCode } from '../StarLpQrCode'
import type { MarketingQrContext } from '@/features/marketing-qr/contract'
import { starLpQrUrl } from '../starLpQr.utils'

let mockMigrationOn = true
jest.mock('@/hooks/useMigrationFlag', () => ({ useMigrationFlag: () => mockMigrationOn }))
jest.mock('@/hooks/useGetDeviceType', () => ({ useDeviceType: () => ({ deviceType: 'web' }) }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false }))
jest.mock('@/utils/deferred-link', () => ({ buildDeferredPayload: jest.fn() }))
jest.mock('@/features/marketing-qr/consent', () => ({ marketingQrAnalyticsAllowed: () => false }))
jest.mock('@/utils/migration.utils', () => ({ storeForDevice: () => null, openStore: jest.fn() }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key, useLocale: () => 'en' }))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: null }) }))
jest.mock('@/components/LandingPage/LandingPageShell', () => ({ LandingPageShell: ({ children }: any) => children }))
jest.mock('@/components/LandingPage/Footer', () => ({ __esModule: true, default: () => null }))
jest.mock('../starLpFonts', () => ({ starLpKnerdFilled: { variable: '' }, starLpKnerdOutline: { variable: '' } }))
jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    default: ({ content }: any) => <div role="dialog">{content}</div>,
}))
jest.mock('@/components/Migration/StoreBadges', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/0_Bruddle/LinkButton', () => ({
    LinkButton: ({ children, href }: any) => <a href={href}>{children}</a>,
}))
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({ children, href, onClick }: any) => (
        <a href={href} onClick={onClick}>
            {children}
        </a>
    ),
}))
jest.mock('react-qr-code', () => ({
    __esModule: true,
    default: ({ value, level }: { value: string; level: string }) => (
        <div data-testid="qr" data-value={value} data-level={level} />
    ),
}))

beforeEach(() => {
    mockMigrationOn = true
})

it.each(['us-europe-accounts', 'qr-argentina', 'qr-brazil', 'request-links', 'self-custody'] as const)(
    'carries %s through the page, CTA, provider and modal into its registered QR',
    async (page: MarketingQrContext['page']) => {
        render(
            <StarLpPage marketingPage={page}>
                <StarLpCta href="/setup" ground="cream" qrPlacement="hero">
                    Download app
                </StarLpCta>
            </StarLpPage>
        )
        fireEvent.click(screen.getByRole('link', { name: 'Download app' }))
        expect(await screen.findByRole('dialog')).toBeInTheDocument()
        expect(await screen.findByTestId('qr')).toHaveAttribute(
            'data-value',
            `${window.location.origin}/home?mqr=${page}-hero-en`
        )
        expect(screen.getByTestId('qr')).toHaveAttribute('data-level', 'M')
    }
)

it.each([
    ['qr-argentina', 'hero-sticker'],
    ['qr-argentina', 'close-sticker'],
    ['qr-brazil', 'hero-sticker'],
    ['qr-brazil', 'close-sticker'],
    ['qr-brazil', 'ways-in'],
] as const)('registers inline %s/%s only when both rollout and app migration are enabled', (campaign, slot) => {
    const { rerender } = render(<StarLpQrCode campaign={campaign} slot={slot} />)
    expect(screen.getByTestId('qr')).toHaveAttribute(
        'data-value',
        `${window.location.origin}/home?mqr=${campaign}-${slot}-en`
    )
    expect(screen.getByTestId('qr')).toHaveAttribute('data-level', 'M')
    mockMigrationOn = false
    rerender(<StarLpQrCode campaign={campaign} slot={slot} />)
    expect(screen.getByTestId('qr')).toHaveAttribute(
        'data-value',
        starLpQrUrl({ origin: window.location.origin, campaign, slot, migrationOn: false })
    )
    expect(screen.getByTestId('qr')).toHaveAttribute('data-level', 'L')
})
