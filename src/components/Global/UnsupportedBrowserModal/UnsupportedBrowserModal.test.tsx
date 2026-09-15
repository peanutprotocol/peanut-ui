import { fireEvent, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { renderWithIntl as render } from '@/test-utils/intl'
import UnsupportedBrowserModal from './index'

const mockIsLikelyWebview = jest.fn()
let mockPasskeySupport = { isSupported: true, isLoading: false }

jest.mock('@/components/Setup/Setup.utils', () => ({
    isLikelyWebview: () => mockIsLikelyWebview(),
}))
jest.mock('@/context/passkeySupportContext', () => ({
    usePasskeySupportContext: () => mockPasskeySupport,
}))
jest.mock('next/navigation', () => ({
    useSearchParams: () => new URLSearchParams(),
}))
jest.mock('@/components/0_Bruddle/Toast', () => ({
    useToast: () => ({ error: jest.fn(), success: jest.fn() }),
}))
jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    default: ({
        visible,
        title,
        description,
        ctas,
        onClose,
        hideModalCloseButton,
    }: {
        visible: boolean
        title: ReactNode
        description: ReactNode
        ctas?: Array<{ text: string; onClick?: () => void }>
        onClose: () => void
        hideModalCloseButton?: boolean
    }) =>
        visible ? (
            <div role="dialog">
                {title}
                <p>{description}</p>
                {ctas?.map(({ text, onClick }) =>
                    onClick ? (
                        <button key={text} onClick={onClick}>
                            {text}
                        </button>
                    ) : (
                        <p key={text}>{text}</p>
                    )
                )}
                {!hideModalCloseButton && <button onClick={onClose}>Close</button>}
            </div>
        ) : null,
}))

describe('UnsupportedBrowserModal', () => {
    beforeEach(() => {
        mockIsLikelyWebview.mockReset()
        mockPasskeySupport = { isSupported: true, isLoading: false }
    })

    it('does not block a main browser that can create a passkey', async () => {
        mockIsLikelyWebview.mockReturnValue(false)

        render(<UnsupportedBrowserModal allowClose={false} />)

        await waitFor(() => expect(mockIsLikelyWebview).toHaveBeenCalled())
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('explains the passkey requirement when a main browser cannot create one', async () => {
        mockIsLikelyWebview.mockReturnValue(false)
        mockPasskeySupport = { isSupported: false, isLoading: false }

        render(<UnsupportedBrowserModal allowClose={false} />)

        expect(await screen.findByRole('dialog')).toHaveTextContent("Passkeys aren't available")
        expect(screen.getByRole('dialog')).toHaveTextContent(
            "If it still doesn't work, try once from another phone or computer."
        )
        expect(screen.getByRole('dialog')).not.toHaveTextContent('different browser')
        expect(screen.queryByRole('button', { name: 'Copy Link' })).not.toBeInTheDocument()
        expect(screen.queryByText('Then paste it in your preferred browser.')).not.toBeInTheDocument()
        expect(screen.queryByText('Open this link in your browser')).not.toBeInTheDocument()
    })

    it('lets users dismiss a passkey warning so roaming-authenticator login remains reachable', async () => {
        mockIsLikelyWebview.mockReturnValue(false)
        mockPasskeySupport = { isSupported: false, isLoading: false }

        render(<UnsupportedBrowserModal allowClose={false} />)

        expect(await screen.findByRole('dialog')).toHaveTextContent("Passkeys aren't available")
        fireEvent.click(screen.getByRole('button', { name: 'Close' }))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('still blocks a detected in-app browser', async () => {
        mockIsLikelyWebview.mockReturnValue(true)
        mockPasskeySupport = { isSupported: false, isLoading: false }

        render(<UnsupportedBrowserModal allowClose={false} />)

        expect(await screen.findByRole('dialog')).toHaveTextContent('Open this link in your browser')
        expect(screen.getByRole('button', { name: 'Copy Link' })).toBeInTheDocument()
        expect(screen.getByText('Then paste it in your preferred browser.')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
    })

    it('can still be shown explicitly by setup checks', () => {
        mockIsLikelyWebview.mockReturnValue(false)

        render(<UnsupportedBrowserModal visible allowClose={false} />)

        expect(screen.getByRole('dialog')).toHaveTextContent('Open this link in your browser')
    })
})
