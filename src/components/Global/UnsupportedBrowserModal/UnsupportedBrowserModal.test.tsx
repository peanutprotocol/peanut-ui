import { screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { renderWithIntl as render } from '@/test-utils/intl'
import UnsupportedBrowserModal from './index'

const mockIsLikelyWebview = jest.fn()

jest.mock('@/components/Setup/Setup.utils', () => ({
    isLikelyWebview: () => mockIsLikelyWebview(),
}))
jest.mock('@/context/passkeySupportContext', () => ({
    // Regression fixture: optional conditional mediation may be unavailable in
    // a supported browser. That must not open the in-app-browser modal.
    usePasskeySupportContext: () => ({ isSupported: false, isLoading: false }),
}))
jest.mock('next/navigation', () => ({
    useSearchParams: () => new URLSearchParams(),
}))
jest.mock('@/components/0_Bruddle/Toast', () => ({
    useToast: () => ({ error: jest.fn(), success: jest.fn() }),
}))
jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    default: ({ visible, title }: { visible: boolean; title: ReactNode }) =>
        visible ? <div role="dialog">{title}</div> : null,
}))

describe('UnsupportedBrowserModal', () => {
    beforeEach(() => {
        mockIsLikelyWebview.mockReset()
    })

    it('does not block a main browser when optional passkey autofill is unavailable', async () => {
        mockIsLikelyWebview.mockReturnValue(false)

        render(<UnsupportedBrowserModal allowClose={false} />)

        await waitFor(() => expect(mockIsLikelyWebview).toHaveBeenCalled())
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('still blocks a detected in-app browser', async () => {
        mockIsLikelyWebview.mockReturnValue(true)

        render(<UnsupportedBrowserModal allowClose={false} />)

        expect(await screen.findByRole('dialog')).toHaveTextContent('Open this link in your browser')
    })

    it('can still be shown explicitly by setup checks', () => {
        mockIsLikelyWebview.mockReturnValue(false)

        render(<UnsupportedBrowserModal visible allowClose={false} />)

        expect(screen.getByRole('dialog')).toHaveTextContent('Open this link in your browser')
    })
})
