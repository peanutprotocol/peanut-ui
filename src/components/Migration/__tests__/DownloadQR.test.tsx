import { render, screen } from '@testing-library/react'
import DownloadQR from '../DownloadQR'
import { buildDeferredPayload } from '@/utils/deferred-link'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('react-qr-code', () => ({
    __esModule: true,
    default: ({ value, level }: { value: string; level: string }) => (
        <a data-testid="qr" href={value} data-level={level}>
            QR
        </a>
    ),
}))
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
    default: ({ payload, iosPayload }: { payload?: string; iosPayload?: string }) => (
        <div data-testid="stores" data-payload={payload ?? ''} data-ios-payload={iosPayload ?? ''} />
    ),
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

it('passes a separate unbounded payload to the iOS store fallback', () => {
    jest.mocked(buildDeferredPayload)
        .mockImplementationOnce(() => 'pnutdl=1&at=small')
        .mockImplementationOnce(() => 'pnutdl=1&at=full-journey')
    render(<DownloadQR surface="landing_door" handoff={{ dest: '/card' }} />)
    expect(screen.getByTestId('stores')).toHaveAttribute('data-payload', 'pnutdl=1&at=small')
    expect(screen.getByTestId('stores')).toHaveAttribute('data-ios-payload', 'pnutdl=1&at=full-journey')
})

it('keeps the bare QR and store links when an explicit handoff cannot be built', () => {
    ;(buildDeferredPayload as jest.Mock).mockImplementationOnce(() => {
        throw new Error('handoff exceeded the Play referrer limit')
    })

    render(<DownloadQR surface="landing_door" handoff={{ dest: '/card' }} />)

    expect(screen.getByTestId('qr')).toHaveAttribute('href', `${window.location.origin}/home?app_entry=1`)
    expect(screen.getByTestId('stores')).toHaveAttribute('data-payload', '')
})

it('uses a registered marketing URL only with explicit context and the gate enabled', () => {
    const previous = process.env.NEXT_PUBLIC_MARKETING_QR_TRACKING
    process.env.NEXT_PUBLIC_MARKETING_QR_TRACKING = 'true'
    try {
        const { rerender } = render(
            <DownloadQR surface="landing_hero" marketingQr={{ page: 'home', placement: 'hero', locale: 'en' }} />
        )
        expect(screen.getByTestId('qr')).toHaveAttribute('href', `${window.location.origin}/q/home-hero-en`)
        expect(screen.getByTestId('qr')).toHaveAttribute('data-level', 'M')
        rerender(<DownloadQR surface="home_banner" />)
        expect(screen.getByTestId('qr')).toHaveAttribute('href', `${window.location.origin}/home?app_entry=1`)
    } finally {
        if (previous === undefined) delete process.env.NEXT_PUBLIC_MARKETING_QR_TRACKING
        else process.env.NEXT_PUBLIC_MARKETING_QR_TRACKING = previous
    }
})

it('keeps explicit campaign handoffs on the old path even if marketing context is supplied', () => {
    const previous = process.env.NEXT_PUBLIC_MARKETING_QR_TRACKING
    process.env.NEXT_PUBLIC_MARKETING_QR_TRACKING = 'true'
    jest.mocked(buildDeferredPayload).mockReturnValue('pnutdl=1&badgeCampaign=door&dest=%2Fcard')
    try {
        render(
            <DownloadQR
                surface="landing_door"
                handoff={{ dest: '/card' }}
                marketingQr={{ page: 'home', placement: 'hero', locale: 'en' }}
            />
        )
        expect(screen.getByTestId('qr')).toHaveAttribute(
            'href',
            `${window.location.origin}/home?app_entry=1&pnutdl=1&badgeCampaign=door&dest=%2Fcard`
        )
    } finally {
        if (previous === undefined) delete process.env.NEXT_PUBLIC_MARKETING_QR_TRACKING
        else process.env.NEXT_PUBLIC_MARKETING_QR_TRACKING = previous
    }
})
