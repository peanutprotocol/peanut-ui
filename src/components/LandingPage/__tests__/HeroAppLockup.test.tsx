import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { HeroAppLockup } from '../HeroAppLockup'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/utils/deferred-link', () => ({ buildDeferredPayload: () => 'pnutdl=1&invite=ABC123' }))
jest.mock('@/utils/migration.utils', () => ({
    storeAnchorHref: (store: string) => `https://store.example/${store}`,
    onStoreAnchorClick: jest.fn(),
}))
jest.mock('@/components/Global/QRCodeWrapper', () => ({
    __esModule: true,
    default: ({ url }: { url: string }) => <div data-testid="qr">{url}</div>,
}))

describe('HeroAppLockup', () => {
    it('encodes the hero surface and the hand-off payload in the QR', () => {
        renderWithIntl(<HeroAppLockup subtext="Join +10,000 cool people" />)
        expect(screen.getByTestId('qr')).toHaveTextContent(
            `${window.location.origin}/app?pnutdl=1&invite=ABC123&s=landing_hero`
        )
    })

    it('shows the scan hint, both stores and the content subtext', () => {
        renderWithIntl(<HeroAppLockup subtext="Join +10,000 cool people" />)
        expect(screen.getByText('Scan with your phone camera to download.')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /app store/i })).toHaveAttribute('href', 'https://store.example/ios')
        expect(screen.getByRole('link', { name: /google play/i })).toHaveAttribute(
            'href',
            'https://store.example/android'
        )
        expect(screen.getByText('Join +10,000 cool people')).toBeInTheDocument()
    })
})
