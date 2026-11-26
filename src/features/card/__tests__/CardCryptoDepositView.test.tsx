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
const onProcessingChange = jest.fn()

function renderView(initial: Partial<Props> = {}) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            <ToastProvider>{children}</ToastProvider>
        </QueryClientProvider>
    )
    let props: Props = { network: 'TRON', gapUsd: 7.5, spendableUsd: 2.5, ...initial }
    const view = render(<CardCryptoDepositView {...props} onDone={onDone} onProcessingChange={onProcessingChange} />, {
        wrapper,
    })
    return {
        ...view,
        rerenderWith: (next: Partial<Props>) => {
            props = { ...props, ...next }
            view.rerender(<CardCryptoDepositView {...props} onDone={onDone} onProcessingChange={onProcessingChange} />)
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
    it('says what came in and what is still missing, and that the minimum still applies', async () => {
        const { rerenderWith } = renderView()
        await screen.findByTestId('card-add-money-address')
        await act(async () => pollOnSuccess?.(4))
        await act(async () => rerenderWith({ spendableUsd: 6.5, gapUsd: 3.5 }))
        const short = screen.getByTestId('card-add-money-short')
        expect(short).toHaveTextContent('shortReceived($4)')
        expect(short).toHaveTextContent('partialContribution.description($3.50)')
        // $3.50 is the rest, below the $5 minimum: the ask is $5 and the note says the extra stays
        const ask = screen.getByTestId('card-add-money-ask')
        expect(ask).toHaveTextContent('sendAsk($5)')
        expect(ask).toHaveTextContent('raisedToMinimum(Tron|$5|$1.50)')
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
        expect(screen.getByTestId('card-add-money-short')).toHaveTextContent('shortReceived($6.50)')
        expect(screen.getByTestId('card-add-money-short')).toHaveTextContent('partialContribution.description($1)')
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
        expect(screen.getByText('shortReceived($4)')).toBeInTheDocument()
        expect(screen.getByText('sendAsk($2.80)')).toBeInTheDocument()
        // the rest is reported before its balance read: processing, not the address and a stale notice
        await act(async () => pollOnSuccess?.(2.8))
        expect(screen.getByTestId('card-add-money-processing')).toBeInTheDocument()
        expect(screen.queryByTestId('qr')).not.toBeInTheDocument()
        await act(async () => rerenderWith({ spendableUsd: 10, gapUsd: 0 }))
        expect(screen.getByTestId('card-add-money-done')).toBeInTheDocument()
    })

    it('never offers the address for a deposit in flight at open while the balance read is stale', async () => {
        jest.useFakeTimers()
        try {
            pollStatus = 'loading'
            const { rerenderWith } = renderView({ gapUsd: 20, spendableUsd: 0 })
            await screen.findByTestId('card-add-money-processing')
            pollStatus = 'not_started'
            await act(async () => pollOnSuccess?.(10))
            // the refresh came back with the old balance: still processing, re-read, no QR
            for (let i = 0; i < 3; i++) await act(async () => void jest.advanceTimersByTime(5000))
            expect(screen.getByTestId('card-add-money-processing')).toBeInTheDocument()
            expect(screen.queryByTestId('qr')).not.toBeInTheDocument()
            // a later read shows the $10: the rest is named against the balance at open
            await act(async () => rerenderWith({ spendableUsd: 10, gapUsd: 10 }))
            expect(screen.getByTestId('card-add-money-short')).toHaveTextContent('shortReceived($10)')
            expect(screen.getByTestId('card-add-money-short')).toHaveTextContent('partialContribution.description($10)')
        } finally {
            jest.useRealTimers()
        }
    })

    it('counts a deposit in flight at open as already in once re-reads never see the balance rise', async () => {
        jest.useFakeTimers()
        try {
            pollStatus = 'loading'
            renderView({ gapUsd: 2.8, spendableUsd: 7.2 })
            await screen.findByTestId('card-add-money-processing')
            pollStatus = 'not_started'
            await act(async () => pollOnSuccess?.(6))
            for (let i = 0; i < 8; i++) await act(async () => void jest.advanceTimersByTime(5000))
            // the money was in the balance before the drawer read it: no stuck processing
            expect(screen.queryByTestId('card-add-money-processing')).not.toBeInTheDocument()
            expect(screen.getByTestId('card-add-money-short')).toHaveTextContent('shortReceived($6)')
            expect(screen.getByText('sendAsk($5)')).toBeInTheDocument()
        } finally {
            jest.useRealTimers()
        }
    })

    it('tells the drawer while a deposit settles, so it can hide its back', async () => {
        const { rerenderWith } = renderView()
        await screen.findByTestId('card-add-money-address')
        expect(onProcessingChange).toHaveBeenLastCalledWith(false)
        await act(async () => pollOnSuccess?.(7.5))
        expect(onProcessingChange).toHaveBeenLastCalledWith(true)
        await act(async () => rerenderWith({ spendableUsd: 10, gapUsd: 0 }))
        expect(onProcessingChange).toHaveBeenLastCalledWith(false)
    })

    it('measures a deposit from where the balance stood, even when the balance shows it before the status', async () => {
        mockCreateDepositAddress.mockResolvedValue({ depositAddress: ADDRESS, minDepositLimitUsd: 1 })
        const { rerenderWith } = renderView({ gapUsd: 6.8, spendableUsd: 3.2 })
        await screen.findByTestId('card-add-money-address')
        pollStatus = 'loading'
        rerenderWith({})
        // the 30s balance poll sees the $5 first; the live ask is now $1.80
        await act(async () => rerenderWith({ spendableUsd: 8.2, gapUsd: 1.8 }))
        pollStatus = 'completed'
        await act(async () => pollOnSuccess?.(5))
        await act(async () => rerenderWith({}))
        expect(screen.getByTestId('card-add-money-short')).toHaveTextContent('shortReceived($5)')
        expect(screen.getByTestId('card-add-money-short')).toHaveTextContent('partialContribution.description($1.80)')
        expect(screen.getByText('sendAsk($1.80)')).toBeInTheDocument()
    })

    it('shows the address after a completed outcome only once the balance is read again', async () => {
        pollStatus = 'completed'
        const pendingReads: Array<() => void> = []
        const refresh = jest
            .spyOn(QueryClient.prototype, 'invalidateQueries')
            .mockImplementation(() => new Promise<void>((resolve) => pendingReads.push(resolve)))
        try {
            renderView()
            await waitFor(() => expect(refresh).toHaveBeenCalledWith({ queryKey: ['balance'] }))
            // a deposit finished seconds ago on /add-money/crypto: no ask before its balance is in
            expect(screen.queryByTestId('qr')).not.toBeInTheDocument()
            await act(async () => pendingReads.forEach((resolve) => resolve()))
            expect(await screen.findByTestId('card-add-money-address')).toBeInTheDocument()
        } finally {
            refresh.mockRestore()
        }
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
