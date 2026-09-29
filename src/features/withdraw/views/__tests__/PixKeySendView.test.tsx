/**
 * PixKeySendView resolves the key's owner on Continue. Only a definitive
 * "unknown key" keeps the user on the screen; every other lookup failure
 * continues to /qr-pay without a name, as before the lookup existed.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PixKeySendView from '@/features/withdraw/views/PixKeySendView'
import { ApiError } from '@/services/api-error'
import { mantecaApi } from '@/services/manteca'
import { pixKeyToBRCode } from '@/utils/pix.utils'

const mockRouterPush = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockRouterPush, back: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
}))
jest.mock('next-intl', () => ({
    useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: (props: { onClick?: () => void; disabled?: boolean; children?: React.ReactNode }) => (
        <button onClick={props.onClick} disabled={props.disabled}>
            {props.children}
        </button>
    ),
}))
// Stands in for the debounced validating input: every change is a valid key.
jest.mock('@/components/Global/ValidatedInput', () => ({
    __esModule: true,
    default: (props: {
        value: string
        onUpdate: (update: { value: string; isValid: boolean; isChanging: boolean }) => void
    }) => (
        <input
            data-testid="pix-key-input"
            value={props.value}
            onChange={(e) => props.onUpdate({ value: e.target.value, isValid: true, isChanging: false })}
        />
    ),
}))
jest.mock('@/services/manteca', () => ({ mantecaApi: { getPixKeyOwner: jest.fn() } }))

const mockGetPixKeyOwner = mantecaApi.getPixKeyOwner as jest.Mock
const PIX_KEY = 'maria@silva.com.br'

function renderView() {
    const client = new QueryClient()
    return render(
        <QueryClientProvider client={client}>
            <PixKeySendView />
        </QueryClientProvider>
    )
}

function enterKeyAndContinue(value: string) {
    fireEvent.change(screen.getByTestId('pix-key-input'), { target: { value } })
    fireEvent.click(screen.getByRole('button', { name: 'common.continue' }))
}

describe('PixKeySendView — owner lookup on Continue', () => {
    beforeEach(() => {
        mockRouterPush.mockReset()
        mockGetPixKeyOwner.mockReset()
    })

    it('continues to /qr-pay once the owner resolves', async () => {
        mockGetPixKeyOwner.mockResolvedValue({ name: 'MARIA DA SILVA', legalIdMasked: null })
        renderView()

        enterKeyAndContinue(PIX_KEY)

        await waitFor(() => expect(mockRouterPush).toHaveBeenCalledTimes(1))
        expect(mockGetPixKeyOwner).toHaveBeenCalledWith(PIX_KEY)
        expect(mockRouterPush.mock.calls[0][0]).toMatch(/^\/qr-pay\?.*&type=PIX&pixKey=maria%40silva\.com\.br$/)
    })

    it('stops on an unknown key and keeps Continue off until the key changes', async () => {
        mockGetPixKeyOwner.mockRejectedValue(
            new ApiError('PIX key not found', { status: 404, code: 'PAYMENT_DESTINATION_NOT_FOUND' })
        )
        renderView()

        enterKeyAndContinue(PIX_KEY)

        expect(await screen.findByText('withdraw.pixKey.notFound')).toBeInTheDocument()
        expect(mockRouterPush).not.toHaveBeenCalled()
        expect(screen.getByRole('button', { name: 'common.continue' })).toBeDisabled()

        fireEvent.change(screen.getByTestId('pix-key-input'), { target: { value: 'maria@silva.com' } })
        expect(screen.getByRole('button', { name: 'common.continue' })).toBeEnabled()
        expect(screen.queryByText('withdraw.pixKey.notFound')).not.toBeInTheDocument()
    })

    it.each([
        ['the provider is unavailable', new ApiError('PIX key lookup unavailable', { status: 502 })],
        ['the user is rate limited', new ApiError('Too many PIX key lookups', { status: 429 })],
        ['the network fails', new TypeError('Failed to fetch')],
    ])('continues without a name when %s', async (_label, error) => {
        mockGetPixKeyOwner.mockRejectedValue(error)
        renderView()

        enterKeyAndContinue(PIX_KEY)

        await waitFor(() => expect(mockRouterPush).toHaveBeenCalledTimes(1))
        expect(screen.queryByText('withdraw.pixKey.notFound')).not.toBeInTheDocument()
    })

    it('does not look up a pasted BR Code, which names its own recipient', async () => {
        renderView()

        enterKeyAndContinue(pixKeyToBRCode(PIX_KEY)!)

        await waitFor(() => expect(mockRouterPush).toHaveBeenCalledTimes(1))
        expect(mockGetPixKeyOwner).not.toHaveBeenCalled()
    })
})
