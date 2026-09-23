import { render, screen } from '@testing-library/react'
import DownloadQR from '../DownloadQR'
import { buildDeferredPayload } from '@/utils/deferred-link'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@/utils/deferred-link', () => ({
    buildDeferredPayload: jest.fn(() => 'pnutdl=1&badgeCampaign=door&dest=%2Fcard'),
}))
jest.mock('@/components/Global/QRCodeWrapper', () => ({
    __esModule: true,
    default: ({ url }: { url: string }) => (
        <a data-testid="qr" href={url}>
            QR
        </a>
    ),
}))
jest.mock('../StoreBadges', () => ({
    __esModule: true,
    default: ({ payload }: { payload?: string }) => <div data-testid="stores" data-payload={payload ?? ''} />,
}))

it('keeps generic downloads bare even when ambient context exists', () => {
    render(<DownloadQR surface="landing_hero" />)
    expect(screen.getByTestId('qr')).toHaveAttribute('href', `${window.location.origin}/home?app_entry=1`)
    expect(screen.getByTestId('stores')).toHaveAttribute('data-payload', '')
})

it('puts an explicit campaign handoff in both the QR and store fallbacks', () => {
    const { rerender } = render(<DownloadQR surface="landing_door" handoff={{ dest: '/card' }} />)
    expect(screen.getByTestId('qr')).toHaveAttribute(
        'href',
        `${window.location.origin}/home?app_entry=1&pnutdl=1&badgeCampaign=door&dest=%2Fcard`
    )
    expect(screen.getByTestId('stores')).toHaveAttribute('data-payload', 'pnutdl=1&badgeCampaign=door&dest=%2Fcard')
    rerender(<DownloadQR surface="landing_hero" />)
    expect(screen.getByTestId('qr')).toHaveAttribute('href', `${window.location.origin}/home?app_entry=1`)
})

it('keeps the bare QR and store links when an explicit handoff cannot be built', () => {
    ;(buildDeferredPayload as jest.Mock).mockImplementationOnce(() => {
        throw new Error('handoff exceeded the Play referrer limit')
    })

    render(<DownloadQR surface="landing_door" handoff={{ dest: '/card' }} />)

    expect(screen.getByTestId('qr')).toHaveAttribute('href', `${window.location.origin}/home?app_entry=1`)
    expect(screen.getByTestId('stores')).toHaveAttribute('data-payload', '')
})
