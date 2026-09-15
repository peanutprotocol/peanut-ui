import { screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { renderWithIntl as render } from '@/test-utils/intl'
import { BrowserType } from '@/hooks/useGetBrowserType'
import UnsupportedBrowserModal from './index'

const mockIsLikelyWebview = jest.fn()
let mockPasskeySupport = { isSupported: true, isLoading: false }
let mockBrowser = { browserType: BrowserType.UNKNOWN as BrowserType | null, isLoading: false }

jest.mock('@/components/Setup/Setup.utils', () => ({
    isLikelyWebview: () => mockIsLikelyWebview(),
}))
jest.mock('@/context/passkeySupportContext', () => ({
    usePasskeySupportContext: () => mockPasskeySupport,
}))
jest.mock('@/hooks/useGetBrowserType', () => ({
    ...jest.requireActual('@/hooks/useGetBrowserType'),
    useGetBrowserType: () => mockBrowser,
}))
jest.mock('next/navigation', () => ({
    useSearchParams: () => new URLSearchParams(),
}))
jest.mock('@/components/0_Bruddle/Toast', () => ({
    useToast: () => ({ error: jest.fn(), success: jest.fn() }),
}))
jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    default: ({ visible, title, description }: { visible: boolean; title: ReactNode; description: ReactNode }) =>
        visible ? (
            <div role="dialog">
                {title}
                <p>{description}</p>
            </div>
        ) : null,
}))

describe('UnsupportedBrowserModal', () => {
    beforeEach(() => {
        mockIsLikelyWebview.mockReset()
        mockPasskeySupport = { isSupported: true, isLoading: false }
        mockBrowser = { browserType: BrowserType.UNKNOWN, isLoading: false }
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
        expect(screen.queryByText('Open this link in your browser')).not.toBeInTheDocument()
    })

    it('recommends another device instead of another browser to someone using Chrome', async () => {
        mockIsLikelyWebview.mockReturnValue(false)
        mockPasskeySupport = { isSupported: false, isLoading: false }
        mockBrowser = { browserType: BrowserType.CHROME, isLoading: false }

        render(<UnsupportedBrowserModal allowClose={false} />)

        expect(await screen.findByRole('dialog')).toHaveTextContent(
            "If it still doesn't work, try once from another phone or computer."
        )
        expect(screen.getByRole('dialog')).not.toHaveTextContent('different browser')
    })

    it('blocks a Safari-looking iOS environment with passkey guidance and recommends another device', async () => {
        mockIsLikelyWebview.mockReturnValue(false)
        mockPasskeySupport = { isSupported: false, isLoading: false }
        mockBrowser = { browserType: BrowserType.SAFARI, isLoading: false }

        render(<UnsupportedBrowserModal allowClose={false} />)

        expect(await screen.findByRole('dialog')).toHaveTextContent(
            "If it still doesn't work, try once from another phone or computer."
        )
        expect(screen.getByRole('dialog')).toHaveTextContent("Passkeys aren't available")
        expect(screen.getByRole('dialog')).not.toHaveTextContent('Open this link in your browser')
        expect(screen.getByRole('dialog')).not.toHaveTextContent('different browser')
    })

    it('waits for browser detection before choosing passkey guidance', async () => {
        mockIsLikelyWebview.mockReturnValue(false)
        mockPasskeySupport = { isSupported: false, isLoading: false }
        mockBrowser = { browserType: null, isLoading: true }

        render(<UnsupportedBrowserModal allowClose={false} />)

        await waitFor(() => expect(mockIsLikelyWebview).toHaveBeenCalled())
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('still blocks a detected in-app browser', async () => {
        mockIsLikelyWebview.mockReturnValue(true)
        mockPasskeySupport = { isSupported: false, isLoading: false }

        render(<UnsupportedBrowserModal allowClose={false} />)

        expect(await screen.findByRole('dialog')).toHaveTextContent('Open this link in your browser')
    })

    it('can still be shown explicitly by setup checks', () => {
        mockIsLikelyWebview.mockReturnValue(false)

        render(<UnsupportedBrowserModal visible allowClose={false} />)

        expect(screen.getByRole('dialog')).toHaveTextContent('Open this link in your browser')
    })
})
