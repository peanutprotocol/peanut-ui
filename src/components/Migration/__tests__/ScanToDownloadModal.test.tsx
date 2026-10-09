import { render, screen } from '@testing-library/react'
import ScanToDownloadModal from '../ScanToDownloadModal'

const mockActionModal = jest.fn(
    ({
        title,
        content,
        ctas,
    }: {
        title: string
        content: React.ReactNode
        onClose: () => void
        ctas?: Array<{ text: string }>
    }) => (
        <div role="dialog">
            <h1>{title}</h1>
            {content}
            {ctas?.map((cta) => (
                <button key={cta.text}>{cta.text}</button>
            ))}
        </div>
    )
)

jest.mock('next-intl', () => ({
    useLocale: () => 'en',
    useTranslations: () => (key: string) => key,
}))
jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    default: (props: unknown) => mockActionModal(props as never),
}))
jest.mock('@/components/0_Bruddle/LinkButton', () => ({
    LinkButton: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))
jest.mock('@/components/Migration/DownloadQR', () => ({
    __esModule: true,
    default: () => <div>download qr</div>,
}))
jest.mock('@/components/Migration/StoreButtons', () => ({
    __esModule: true,
    default: () => <div>store button</div>,
}))
let mockDevice = 'web'
jest.mock('@/hooks/useGetDeviceType', () => ({
    ...jest.requireActual('@/hooks/useGetDeviceType'),
    useDeviceType: () => ({ deviceType: mockDevice }),
}))

describe('ScanToDownloadModal', () => {
    it('keeps dismissal on the modal chrome without rendering a close CTA', () => {
        const onClose = jest.fn()
        render(<ScanToDownloadModal visible onClose={onClose} surface="landing_hero" />)

        const props = mockActionModal.mock.calls[0][0]
        expect(props.onClose).toBe(onClose)
        expect(props).not.toHaveProperty('ctas')
        expect(screen.queryByRole('button', { name: 'close' })).not.toBeInTheDocument()
    })

    it('offers Log in to logged-out visitors instead of the support link', () => {
        render(<ScanToDownloadModal visible onClose={jest.fn()} surface="landing_hero" showLogIn />)
        expect(screen.getByRole('link', { name: 'qr.logIn' })).toHaveAttribute('href', '/setup?step=login')
        expect(screen.queryByRole('link', { name: 'sunset.supportLink' })).not.toBeInTheDocument()
    })

    it('keeps the support link for logged-in users', () => {
        render(<ScanToDownloadModal visible onClose={jest.fn()} surface="home_banner" />)
        expect(screen.getByRole('link', { name: 'sunset.supportLink' })).toBeInTheDocument()
        expect(screen.queryByRole('link', { name: 'qr.logIn' })).not.toBeInTheDocument()
    })

    it.each([
        ['web', 'download qr'],
        ['ios', 'store button'],
        ['android', 'store button'],
    ])('on %s shows the %s next to Log in', (device, download) => {
        mockDevice = device
        render(<ScanToDownloadModal visible onClose={jest.fn()} surface="landing_hero" showLogIn />)
        expect(screen.getByText(download)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'qr.logIn' })).toHaveAttribute('href', '/setup?step=login')
        mockDevice = 'web'
    })
})
