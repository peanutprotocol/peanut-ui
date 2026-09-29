/**
 * PixKeySendView resolves the key's owner on Continue. Only a definitive
 * "unknown key" keeps the user on the screen; every other lookup failure
 * continues to /qr-pay without a name, as before the lookup existed.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
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
// Stands in for the debounced validating input without the debounce: it runs
// `validate` on every value and on every validationNonce, like the real one.
jest.mock('@/components/Global/ValidatedInput', () => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react')
    function MockValidatedInput(props: {
        value: string
        validationNonce?: number
        validate: (value: string) => Promise<boolean>
        onUpdate: (update: { value: string; isValid: boolean; isChanging: boolean }) => void
    }) {
        const { value, validationNonce, validate, onUpdate } = props
        useEffect(() => {
            if (!value) return
            let isStale = false
            validate(value).then((isValid) => {
                if (!isStale) onUpdate({ value, isValid, isChanging: false })
            })
            return () => {
                isStale = true
            }
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [value, validationNonce])
        return (
            <input
                data-testid="pix-key-input"
                value={value}
                onChange={(e) => onUpdate({ value: e.target.value, isValid: false, isChanging: true })}
            />
        )
    }
    return { __esModule: true, default: MockValidatedInput }
})
jest.mock('@/services/manteca', () => ({ mantecaApi: { getPixKeyOwner: jest.fn() } }))

const mockGetPixKeyOwner = mantecaApi.getPixKeyOwner as jest.Mock
const PIX_KEY = 'maria@silva.com.br'
const OTHER_KEY = 'maria@silva.com'
const NOT_FOUND = new ApiError('PIX key not found', { status: 404, code: 'PAYMENT_DESTINATION_NOT_FOUND' })

function renderView() {
    const client = new QueryClient()
    return render(
        <QueryClientProvider client={client}>
            <PixKeySendView />
        </QueryClientProvider>
    )
}

const continueButton = () => screen.getByRole('button', { name: 'common.continue' })

async function enterKey(value: string) {
    fireEvent.change(screen.getByTestId('pix-key-input'), { target: { value } })
    await waitFor(() => expect(continueButton()).toBeEnabled())
}

async function enterKeyAndContinue(value: string) {
    await enterKey(value)
    fireEvent.click(continueButton())
}

/** A lookup that answers only when the test says so. */
function deferredLookup() {
    let settle: { resolve: (value: unknown) => void; reject: (error: unknown) => void } = {
        resolve: () => {},
        reject: () => {},
    }
    mockGetPixKeyOwner.mockImplementationOnce(
        () =>
            new Promise((resolve, reject) => {
                settle = { resolve, reject }
            })
    )
    return {
        resolve: (value: unknown) => act(async () => settle.resolve(value)),
        reject: (error: unknown) => act(async () => settle.reject(error)),
    }
}

describe('PixKeySendView — owner lookup on Continue', () => {
    beforeEach(() => {
        mockRouterPush.mockReset()
        mockGetPixKeyOwner.mockReset()
    })

    it('continues to /qr-pay once the owner resolves', async () => {
        mockGetPixKeyOwner.mockResolvedValue({ name: 'MARIA DA SILVA', legalIdMasked: null })
        renderView()

        await enterKeyAndContinue(PIX_KEY)

        await waitFor(() => expect(mockRouterPush).toHaveBeenCalledTimes(1))
        expect(mockGetPixKeyOwner).toHaveBeenCalledWith(PIX_KEY)
        expect(mockRouterPush.mock.calls[0][0]).toMatch(/^\/qr-pay\?.*&type=PIX&pixKey=maria%40silva\.com\.br$/)
    })

    it('looks up and pays a punctuated CPF in its digits-only form', async () => {
        mockGetPixKeyOwner.mockResolvedValue({ name: 'MARIA DA SILVA', legalIdMasked: '12*******09' })
        renderView()

        await enterKeyAndContinue('123.456.789-09')

        await waitFor(() => expect(mockRouterPush).toHaveBeenCalledTimes(1))
        expect(mockGetPixKeyOwner).toHaveBeenCalledWith('12345678909')
        expect(mockRouterPush.mock.calls[0][0]).toContain('pixKey=12345678909')
    })

    it('stops on an unknown key and marks the input invalid until the key changes', async () => {
        mockGetPixKeyOwner.mockRejectedValue(NOT_FOUND)
        renderView()

        await enterKeyAndContinue(PIX_KEY)

        expect(await screen.findByText('withdraw.pixKey.notFound')).toBeInTheDocument()
        expect(mockRouterPush).not.toHaveBeenCalled()
        expect(continueButton()).toBeDisabled()

        await enterKey(OTHER_KEY)
        expect(screen.queryByText('withdraw.pixKey.notFound')).not.toBeInTheDocument()
    })

    it('remembers an unknown key, so going back to it costs no second lookup', async () => {
        mockGetPixKeyOwner.mockRejectedValue(NOT_FOUND)
        renderView()
        await enterKeyAndContinue(PIX_KEY)
        await screen.findByText('withdraw.pixKey.notFound')
        await enterKey(OTHER_KEY)

        fireEvent.change(screen.getByTestId('pix-key-input'), { target: { value: PIX_KEY } })

        expect(await screen.findByText('withdraw.pixKey.notFound')).toBeInTheDocument()
        expect(continueButton()).toBeDisabled()
        expect(mockGetPixKeyOwner).toHaveBeenCalledTimes(1)
    })

    it.each([
        ['the provider is unavailable', new ApiError('PIX key lookup unavailable', { status: 502 })],
        ['the user is rate limited', new ApiError('Too many PIX key lookups', { status: 429 })],
        ['the network fails', new TypeError('Failed to fetch')],
    ])('continues without a name when %s', async (_label, error) => {
        mockGetPixKeyOwner.mockRejectedValue(error)
        renderView()

        await enterKeyAndContinue(PIX_KEY)

        await waitFor(() => expect(mockRouterPush).toHaveBeenCalledTimes(1))
        expect(screen.queryByText('withdraw.pixKey.notFound')).not.toBeInTheDocument()
    })

    it('ignores an answer for a key the user has already replaced', async () => {
        const lookup = deferredLookup()
        renderView()
        await enterKeyAndContinue(PIX_KEY)

        fireEvent.change(screen.getByTestId('pix-key-input'), { target: { value: OTHER_KEY } })
        await lookup.reject(NOT_FOUND)

        expect(mockRouterPush).not.toHaveBeenCalled()
        expect(screen.queryByText('withdraw.pixKey.notFound')).not.toBeInTheDocument()
        await waitFor(() => expect(continueButton()).toBeEnabled())
    })

    it('does not navigate after the user has left the screen', async () => {
        const lookup = deferredLookup()
        const { unmount } = renderView()
        await enterKeyAndContinue(PIX_KEY)

        unmount()
        await lookup.resolve({ name: 'MARIA DA SILVA', legalIdMasked: null })

        expect(mockRouterPush).not.toHaveBeenCalled()
    })

    it('does not look up a pasted BR Code, which names its own recipient', async () => {
        renderView()

        await enterKeyAndContinue(pixKeyToBRCode(PIX_KEY)!)

        await waitFor(() => expect(mockRouterPush).toHaveBeenCalledTimes(1))
        expect(mockGetPixKeyOwner).not.toHaveBeenCalled()
    })
})
