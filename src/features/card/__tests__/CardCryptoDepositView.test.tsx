import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ToastProvider } from '@/components/0_Bruddle/Toast'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import type { RhinoChainType } from '@/services/services.types'
import { CardCryptoDepositView } from '../components/CardCryptoDepositView'

const mockCapture = jest.fn()
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: (...args: unknown[]) => mockCapture(...args) },
}))
// key passthrough; values follow in brackets so the amounts a line carries are asserted
jest.mock('next-intl', () => ({
    useTranslations: () => (key: string, values?: Record<string, unknown>) =>
        values ? `${key}(${Object.values(values).join('|')})` : key,
}))
jest.mock('@/components/Global/QRCodeWrapper', () => ({
    __esModule: true,
    default: ({ url }: { url: string }) => <div data-testid="qr">{url}</div>,
}))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: 'u1' } } }) }))
jest.mock('@/hooks/wallet/useWallet', () => ({ useWallet: () => ({ address: '0xwallet' }) }))
const mockCopy = jest.fn((_text: string) => Promise.resolve(true))
jest.mock('@/utils/clipboard.utils', () => ({ copyTextToClipboard: (text: string) => mockCopy(text) }))

const ADDRESS = '0x1234567890abcdef1234567890abcdef1234beef'
const mockCreateDepositAddress = jest.fn()
jest.mock('@/services/rhino', () => ({
    rhinoApi: { createDepositAddress: (...args: unknown[]) => mockCreateDepositAddress(...args) },
}))

// the Rhino status poll: the test drives the first read, its status and the success callback
let pollStatus: 'not_started' | 'loading' | 'failed' | 'completed' = 'not_started'
let pollRead = true
let pollOptions: unknown
let pollOnSuccess: ((amount: number) => void) | undefined
let pollCompletedAmount: number | undefined
const mockResetStatus = jest.fn(async () => {
    pollStatus = 'not_started'
})
jest.mock('@/components/AddMoney/hooks/useCryptoDepositPolling', () => ({
    useCryptoDepositPolling: (
        _address: string | undefined,
        onSuccess: (amount: number) => void,
        _chargeId: string | undefined,
        options: unknown
    ) => {
        pollOnSuccess = onSuccess
        pollOptions = options
        // as the real hook: a completed read reports its amount from an effect, before the caller's own
        const { useEffect } = jest.requireActual<typeof import('react')>('react')
        useEffect(() => {
            if (_address && pollRead && pollStatus === 'completed' && pollCompletedAmount !== undefined)
                onSuccess(pollCompletedAmount)
        }, [_address, onSuccess])
        return { status: pollStatus, resetStatus: mockResetStatus, isResetting: false, isStatusRead: pollRead }
    },
}))

beforeEach(() => {
    jest.clearAllMocks()
    pollStatus = 'not_started'
    pollRead = true
    pollOptions = undefined
    pollOnSuccess = undefined
    pollCompletedAmount = undefined
    mockCreateDepositAddress.mockResolvedValue({
        depositAddress: ADDRESS,
        minDepositLimitUsd: 5,
        maxDepositLimitUsd: 10000,
    })
})

type Props = { network: RhinoChainType; gapUsd: number | undefined; spendableUsd: number | undefined }
const onDone = jest.fn()

function renderView(initial: Partial<Props> = {}) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            <ToastProvider>{children}</ToastProvider>
        </QueryClientProvider>
    )
    let props: Props = { network: 'TRON', gapUsd: 7.5, spendableUsd: 2.5, ...initial }
    const view = render(<CardCryptoDepositView {...props} onDone={onDone} />, { wrapper })
    return {
        ...view,
        rerenderWith: (next: Partial<Props>) => {
            props = { ...props, ...next }
            view.rerender(<CardCryptoDepositView {...props} onDone={onDone} />)
        },
    }
}

describe('the first status read', () => {
    it('reads the status at once instead of after the poll delay', async () => {
        renderView()
        await screen.findByTestId('card-add-money-address')
        expect(pollOptions).toEqual({ readNow: true })
    })

    it('shows no address until the status is read', async () => {
        pollRead = false
        renderView()
        await act(async () => {})
        expect(screen.queryByTestId('qr')).not.toBeInTheDocument()
        expect(mockResetStatus).not.toHaveBeenCalled()
    })

    it('keeps a deposit already on its way: processing, no clear, no second address', async () => {
        pollStatus = 'loading'
        renderView()
        expect(await screen.findByTestId('card-add-money-processing')).toBeInTheDocument()
        expect(screen.queryByTestId('qr')).not.toBeInTheDocument()
        expect(mockResetStatus).not.toHaveBeenCalled()
    })

    it.each(['completed', 'failed'] as const)('clears a %s outcome an earlier deposit left', async (outcome) => {
        pollStatus = outcome
        renderView()
        expect(await screen.findByTestId('card-add-money-address')).toBeInTheDocument()
        expect(mockResetStatus).toHaveBeenCalledTimes(1)
        expect(screen.queryByText('marketMovedTitle')).not.toBeInTheDocument()
    })

    it('does not count an earlier completed deposit as this one', async () => {
        pollStatus = 'completed'
        // the poll reports the stale outcome on its first read, before the check has run
        pollCompletedAmount = 7.5
        renderView()
        await screen.findByTestId('card-add-money-address')
        expect(mockCapture).not.toHaveBeenCalled()
        expect(screen.queryByTestId('card-add-money-processing')).not.toBeInTheDocument()
    })

    it('offers a retry when this deposit failed after the first read', async () => {
        const { rerenderWith } = renderView()
        await screen.findByTestId('card-add-money-address')
        pollStatus = 'failed'
        rerenderWith({})
        expect(screen.getByText('marketMovedTitle')).toBeInTheDocument()
        fireEvent.click(screen.getByText('tryAgain'))
        expect(mockResetStatus).toHaveBeenCalledTimes(1)
    })
})

describe('a short deposit', () => {
    it('says what was received and asks one amount: the new ask, raised to the minimum', async () => {
        const { rerenderWith } = renderView()
        await screen.findByTestId('card-add-money-address')
        await act(async () => pollOnSuccess?.(4))
        await act(async () => rerenderWith({ spendableUsd: 6.5, gapUsd: 3.5 }))
        expect(screen.getByTestId('card-add-money-short')).toHaveTextContent('partialContribution.title($4|$7.50)')
        const ask = screen.getByTestId('card-add-money-ask')
        // $3.50 is the rest, below the $5 minimum: the ask is $5 and the note says the extra stays
        expect(ask).toHaveTextContent('sendAsk($5)')
        expect(ask).toHaveTextContent('raisedToMinimum(Tron|$5|$1.50)')
        // no second, different "send" amount anywhere
        expect(document.body.textContent).not.toContain('$3.50')
        expect(screen.queryByText(/partialContribution\.description/)).not.toBeInTheDocument()
        expect(mockResetStatus).toHaveBeenCalled()
    })

    it('asks for the exact rest when the minimum is lower', async () => {
        mockCreateDepositAddress.mockResolvedValue({ depositAddress: ADDRESS, minDepositLimitUsd: 1 })
        const { rerenderWith } = renderView()
        await screen.findByTestId('card-add-money-address')
        await act(async () => pollOnSuccess?.(4))
        await act(async () => rerenderWith({ spendableUsd: 6.5, gapUsd: 3.5 }))
        expect(screen.getByTestId('card-add-money-ask')).toHaveTextContent('sendAsk($3.50)')
        expect(screen.queryByText(/raisedToMinimum/)).not.toBeInTheDocument()
    })

    it('reads a deposit a fraction of a cent under the ask as full', async () => {
        renderView()
        await screen.findByTestId('card-add-money-address')
        await act(async () => pollOnSuccess?.(7.499))
        expect(screen.getByTestId('card-add-money-processing')).toBeInTheDocument()
        expect(screen.queryByTestId('card-add-money-short')).not.toBeInTheDocument()
    })

    it('names the EVM family, not "EVM", in the minimum note', async () => {
        renderView({ network: 'EVM', gapUsd: 2, spendableUsd: 8 })
        await screen.findByTestId('card-add-money-address')
        expect(screen.getByTestId('card-add-money-ask')).toHaveTextContent('raisedToMinimum(evmNetworks|$5|$3)')
    })
})

describe('after a full deposit', () => {
    it('shows processing until the balance read moves', async () => {
        const { rerenderWith } = renderView()
        await screen.findByTestId('card-add-money-address')
        await act(async () => pollOnSuccess?.(7.5))
        expect(screen.getByTestId('card-add-money-processing')).toBeInTheDocument()
        expect(mockCapture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.DEPOSIT_COMPLETED,
            expect.objectContaining({ amount: 7.5, chain_type: 'TRON', method_type: 'crypto' })
        )
        // the same balance read again: still processing
        rerenderWith({ spendableUsd: 2.5 })
        expect(screen.getByTestId('card-add-money-processing')).toBeInTheDocument()
    })

    it('turns into a short deposit when the moved balance still leaves a gap', async () => {
        const { rerenderWith } = renderView()
        await screen.findByTestId('card-add-money-address')
        await act(async () => pollOnSuccess?.(7.5))
        // a fee was taken on the way: the balance read lands $1 short of the minimum
        await act(async () => rerenderWith({ spendableUsd: 9, gapUsd: 1 }))
        expect(screen.getByTestId('card-add-money-short')).toHaveTextContent('partialContribution.title($6.50|$7.50)')
        expect(screen.getByTestId('card-add-money-ask')).toHaveTextContent('sendAsk($5)')
    })

    it('says done to a user who was already funded, once the balance moves', async () => {
        const { rerenderWith } = renderView({ gapUsd: 0, spendableUsd: 12 })
        await screen.findByTestId('card-add-money-address')
        await act(async () => pollOnSuccess?.(20))
        expect(screen.getByTestId('card-add-money-processing')).toBeInTheDocument()
        await act(async () => rerenderWith({ spendableUsd: 32 }))
        const done = screen.getByTestId('card-add-money-done')
        expect(done).toHaveTextContent('doneTitle')
        fireEvent.click(screen.getByText('done'))
        expect(onDone).toHaveBeenCalledTimes(1)
    })

    it('says done at once when the balance read moved before the deposit was reported', async () => {
        const { rerenderWith } = renderView({ gapUsd: 0, spendableUsd: 12 })
        await screen.findByTestId('card-add-money-address')
        rerenderWith({ spendableUsd: 32 })
        await act(async () => pollOnSuccess?.(20))
        expect(screen.getByTestId('card-add-money-done')).toBeInTheDocument()
    })
})

describe('the address field', () => {
    it('shortens the address in the middle, keeps the last 4, and copies all of it', async () => {
        renderView()
        await screen.findByTestId('card-add-money-address')
        const field = screen.getByDisplayValue(/…/) as HTMLInputElement
        expect(field.value.endsWith('beef')).toBe(true)
        expect(field.value.startsWith('0x1234')).toBe(true)
        expect(field.value.length).toBeLessThan(ADDRESS.length)
        await act(async () => fireEvent.click(screen.getByText('copyField.copy')))
        expect(mockCopy).toHaveBeenCalledWith(ADDRESS)
    })
})

describe('deposits and balance reads in either order (review of fix round 1)', () => {
    it('waits for the rest of a short deposit to land instead of offering the address again', async () => {
        mockCreateDepositAddress.mockResolvedValue({ depositAddress: ADDRESS, minDepositLimitUsd: 1 })
        const { rerenderWith } = renderView({ gapUsd: 6.8, spendableUsd: 3.2 })
        await screen.findByTestId('card-add-money-address')
        await act(async () => pollOnSuccess?.(4))
        expect(screen.getByTestId('card-add-money-processing')).toBeInTheDocument()
        await act(async () => rerenderWith({ spendableUsd: 7.2, gapUsd: 2.8 }))
        expect(screen.getByText('partialContribution.title($4|$6.80)')).toBeInTheDocument()
        expect(screen.getByText('sendAsk($2.80)')).toBeInTheDocument()
        // the rest is reported before its balance read: processing, not the address and a stale notice
        await act(async () => pollOnSuccess?.(2.8))
        expect(screen.getByTestId('card-add-money-processing')).toBeInTheDocument()
        expect(screen.queryByTestId('qr')).not.toBeInTheDocument()
        await act(async () => rerenderWith({ spendableUsd: 10, gapUsd: 0 }))
        expect(screen.getByTestId('card-add-money-done')).toBeInTheDocument()
    })

    it('resolves a deposit already on its way at open after one fresh balance read', async () => {
        pollStatus = 'loading'
        const { rerenderWith } = renderView({ gapUsd: 2.8, spendableUsd: 7.2 })
        await screen.findByTestId('card-add-money-processing')
        pollStatus = 'not_started'
        await act(async () => pollOnSuccess?.(6))
        await act(async () => rerenderWith({}))
        // the money was already in the balance: the live gap names the rest, no stuck processing
        await waitFor(() => expect(screen.queryByTestId('card-add-money-processing')).not.toBeInTheDocument())
        expect(screen.getByText('sendAsk($5)')).toBeInTheDocument()
    })

    it('offers a retry when an old outcome cannot be cleared, instead of an address no poll watches', async () => {
        pollStatus = 'completed'
        mockResetStatus.mockRejectedValueOnce(new Error('down'))
        renderView()
        expect(await screen.findByTestId('card-add-money-clear-failed')).toBeInTheDocument()
        expect(screen.queryByTestId('qr')).not.toBeInTheDocument()
        fireEvent.click(screen.getByText('retry'))
        await screen.findByTestId('card-add-money-address')
    })
})
