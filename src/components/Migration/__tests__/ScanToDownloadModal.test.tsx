import { render, screen } from '@testing-library/react'
import ScanToDownloadModal from '../ScanToDownloadModal'

const mockActionModal = jest.fn(
    ({ title, content, ctas }: { title: string; content: React.ReactNode; ctas?: Array<{ text: string }> }) => (
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

describe('ScanToDownloadModal', () => {
    it('keeps dismissal on the modal chrome without rendering a close CTA', () => {
        const onClose = jest.fn()
        render(<ScanToDownloadModal visible onClose={onClose} surface="landing_hero" />)

        const props = mockActionModal.mock.calls[0][0] as { onClose: () => void; ctas?: unknown }
        expect(props.onClose).toBe(onClose)
        expect(props).not.toHaveProperty('ctas')
        expect(screen.queryByRole('button', { name: 'close' })).not.toBeInTheDocument()
    })
})
