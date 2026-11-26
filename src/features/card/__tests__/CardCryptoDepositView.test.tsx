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

// The fresh balance read every money decision runs on: `live` is what the chain and the card overview
// say now; `liveFails` makes reads fail; `liveGate` holds reads until the test lets them go.
let live = 2.5
let liveFails = false
let liveGate: Promise<void> | null = null
const mockReadLive = jest.fn(async () => {
    if (liveGate) await liveGate
    if (liveFails) throw new Error('read failed')
    return live
})
jest.mock('@/features/card/readLiveSpendableUsd', () => ({ readLiveSpendableUsd: () => mockReadLive() }))

// The Rhino status poll: `pollRead` is the API's own answer (a clear's "not started" is not one);
// `pollError`: the read failed with no answer known. The test drives status and the success callback.
let pollStatus: 'not_started' | 'loading' | 'failed' | 'completed' = 'not_started'
let pollRead = true
let pollError = false
// the latest poll failed after an earlier answer
let pollFailing = false
const mockRefetchStatus = jest.fn()
let pollOptions: unknown
let pollOnSuccess: ((amount: number) => void) | undefined
let pollCompletedAmount: number | undefined
let resetFails = false
const mockResetStatus = jest.fn(async () => {
    if (resetFails) throw new Error('reset failed')
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
        return {
            status: pollStatus,
            resetStatus: mockResetStatus,
            isResetting: false,
            isStatusRead: pollRead,
            statusError: pollError,
            statusFailing: pollFailing,
            refetchStatus: mockRefetchStatus,
        }
    },
}))

beforeEach(() => {
    jest.clearAllMocks()
    // the deposit event is sent once per deposit across openings; each test starts with none sent
    localStorage.clear()
    live = 2.5
    liveFails = false
    liveGate = null
    pollStatus = 'not_started'
    pollRead = true
    pollError = false
    pollFailing = false
    pollOptions = undefined
    pollOnSuccess = undefined
    pollCompletedAmount = undefined
    resetFails = false
    mockCreateDepositAddress.mockResolvedValue({
        depositAddress: ADDRESS,
        minDepositLimitUsd: 5,
        maxDepositLimitUsd: 10000,
    })
})
afterEach(() => jest.useRealTimers())

const onDone = jest.fn()
const onProcessingChange = jest.fn()

function renderView(network: RhinoChainType = 'TRON') {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            <ToastProvider>{children}</ToastProvider>
        </QueryClientProvider>
    )
    const element = () => (
        <CardCryptoDepositView network={network} onDone={onDone} onProcessingChange={onProcessingChange} />
    )
    const view = render(element(), { wrapper })
    return { ...view, rerender: () => view.rerender(element()) }
}

/** lets the held deposit's next fresh read run (reads after the first are 5 s apart) */
const nextRead = () => act(async () => void jest.advanceTimersByTime(5_000))
/** about a minute of held reads: enough flat ones to release a completed outcome found at open */
const aMinuteOfReads = async () => {
    for (let i = 0; i < 14; i++) await nextRead()
}
const deposits = () => mockCapture.mock.calls.filter(([event]) => event === ANALYTICS_EVENTS.DEPOSIT_COMPLETED)

describe('the address shows only on the API\'s own "not started" and a fresh balance read', () => {
    it('reads the status at once, not after the poll delay', async () => {
        renderView()
        await screen.findByTestId('card-add-money-address')
        expect(pollOptions).toEqual({ readNow: true })
    })

    it('asks from a fresh balance read, and shows nothing until that read is back', async () => {
        let release: () => void = () => {}
        liveGate = new Promise((resolve) => (release = resolve))
        renderView()
        await waitFor(() => expect(mockReadLive).toHaveBeenCalled())
        expect(screen.queryByTestId('qr')).not.toBeInTheDocument()
        live = 3.2
        await act(async () => release())
        // $10 minus the fresh $3.20, not any cached step balance
        expect(await screen.findByTestId('card-add-money-ask')).toHaveTextContent('sendAsk($6.80)')
    })

    it('shows a retry, never the address, when the fresh balance read fails, and asks after it works', async () => {
        liveFails = true
        renderView()
        expect(await screen.findByTestId('card-add-money-check-failed')).toBeInTheDocument()
        expect(screen.queryByTestId('qr')).not.toBeInTheDocument()
        liveFails = false
        fireEvent.click(screen.getByText('retry'))
        expect(await screen.findByTestId('card-add-money-address')).toBeInTheDocument()
    })

    it('shows nothing until the API answers', async () => {
        pollRead = false
        renderView()
        await act(async () => {})
        expect(screen.queryByTestId('qr')).not.toBeInTheDocument()
        expect(mockReadLive).not.toHaveBeenCalled()
    })

    it('shows a retry, never the address, when the status read fails', async () => {
        pollRead = false
        pollError = true
        const view = renderView()
        expect(await screen.findByTestId('card-add-money-check-failed')).toBeInTheDocument()
        fireEvent.click(screen.getByText('retry'))
        expect(mockRefetchStatus).toHaveBeenCalled()
        pollRead = true
        pollError = false
        view.rerender()
        expect(await screen.findByTestId('card-add-money-address')).toBeInTheDocument()
    })

    it('hides the address behind a retry while the status poll fails, and shows it again once it reads', async () => {
        const view = renderView()
        await screen.findByTestId('card-add-money-address')
        // a deposit on its way could not be seen while polls fail
        pollFailing = true
        view.rerender()
        expect(await screen.findByTestId('card-add-money-check-failed')).toBeInTheDocument()
        expect(screen.queryByTestId('qr')).not.toBeInTheDocument()
        fireEvent.click(screen.getByText('retry'))
        expect(mockRefetchStatus).toHaveBeenCalled()
        pollFailing = false
        view.rerender()
        expect(await screen.findByTestId('card-add-money-address')).toBeInTheDocument()
    })

    it('takes the next deposit from the read a balance retry brings, not the read at open', async () => {
        jest.useFakeTimers()
        pollStatus = 'failed'
        // the read at open works, the read after the clear fails
        mockReadLive.mockResolvedValueOnce(2.5).mockRejectedValueOnce(new Error('read failed'))
        renderView()
        expect(await screen.findByTestId('card-add-money-check-failed')).toBeInTheDocument()
        live = 4
        fireEvent.click(screen.getByText('retry'))
        await screen.findByTestId('card-add-money-address')
        pollStatus = 'completed'
        await act(async () => pollOnSuccess?.(3))
        live = 7
        await nextRead()
        // $3 over the $4 the retry read, not $4.50 over the $2.50 read at open
        expect(await screen.findByTestId('card-add-money-short')).toHaveTextContent('shortReceived($3)')
    })

    it('clears a failed outcome against a fresh read, then shows the address', async () => {
        pollStatus = 'failed'
        renderView()
        expect(await screen.findByTestId('card-add-money-address')).toBeInTheDocument()
        expect(mockResetStatus).toHaveBeenCalledTimes(1)
        // the read at open and the read after the clear
        expect(mockReadLive).toHaveBeenCalledTimes(2)
    })
})

describe('a deposit already on its way at open', () => {
    it('stays processing, with no cap, until a fresh read shows the balance rise', async () => {
        jest.useFakeTimers()
        pollStatus = 'loading'
        renderView()
        expect(await screen.findByTestId('card-add-money-processing')).toBeInTheDocument()
        // the provider says completed; two minutes of fresh reads that never rise
        pollStatus = 'completed'
        await act(async () => pollOnSuccess?.(6))
        for (let i = 0; i < 24; i++) await nextRead()
        expect(screen.getByTestId('card-add-money-processing')).toBeInTheDocument()
        expect(screen.queryByTestId('qr')).not.toBeInTheDocument()
        expect(mockResetStatus).not.toHaveBeenCalled()
        // it lands: the rest is named from where the balance stood at open
        live = 8.5
        for (let i = 0; i < 4; i++) await nextRead()
        expect(await screen.findByTestId('card-add-money-short')).toHaveTextContent('shortReceived($6)')
        expect(screen.getByTestId('card-add-money-short')).toHaveTextContent('shortStillNeeded($1.50)')
    })
})

describe('a completed outcome found at open', () => {
    it('is counted once, and shows the address only after fresh reads show it was already in', async () => {
        jest.useFakeTimers()
        pollStatus = 'completed'
        pollCompletedAmount = 7.5
        const first = renderView()
        await waitFor(() => expect(mockResetStatus).toHaveBeenCalledTimes(1))
        expect(screen.queryByTestId('qr')).not.toBeInTheDocument()
        // a few flat reads are not enough: a recent deposit may still be on its way into the balance
        await nextRead()
        await nextRead()
        expect(screen.queryByTestId('qr')).not.toBeInTheDocument()
        // a minute of flat reads: still no address on its own, only the choice to send more
        await aMinuteOfReads()
        const processing = screen.getByTestId('card-add-money-processing')
        expect(processing).toHaveTextContent('stillLandingBody')
        expect(screen.queryByTestId('qr')).not.toBeInTheDocument()
        await aMinuteOfReads()
        expect(screen.queryByTestId('qr')).not.toBeInTheDocument()
        fireEvent.click(screen.getByTestId('card-add-money-send-more'))
        expect(await screen.findByTestId('card-add-money-address')).toBeInTheDocument()
        expect(screen.queryByTestId('card-add-money-short')).not.toBeInTheDocument()
        expect(deposits()).toHaveLength(1)
        // the same outcome read again on a later opening is not counted twice
        first.unmount()
        pollStatus = 'completed'
        renderView()
        await waitFor(() => expect(mockResetStatus).toHaveBeenCalledTimes(2))
        expect(deposits()).toHaveLength(1)
    })

    it('after "Send more instead", keeps reading, so the ask shrinks if the old deposit lands', async () => {
        jest.useFakeTimers()
        mockCreateDepositAddress.mockResolvedValue({ depositAddress: ADDRESS, minDepositLimitUsd: 1 })
        pollStatus = 'completed'
        renderView()
        await waitFor(() => expect(mockResetStatus).toHaveBeenCalled())
        await aMinuteOfReads()
        fireEvent.click(screen.getByTestId('card-add-money-send-more'))
        expect(await screen.findByTestId('card-add-money-ask')).toHaveTextContent('sendAsk($7.50)')
        // the old deposit lands while the address is up
        live = 6.5
        await act(async () => void jest.advanceTimersByTime(15_000))
        await waitFor(() => expect(screen.getByTestId('card-add-money-ask')).toHaveTextContent('sendAsk($3.50)'))
    })

    it('after "Send more instead", says done when a fresh read shows the gap covered', async () => {
        jest.useFakeTimers()
        pollStatus = 'completed'
        renderView()
        await waitFor(() => expect(mockResetStatus).toHaveBeenCalled())
        await aMinuteOfReads()
        fireEvent.click(screen.getByTestId('card-add-money-send-more'))
        await screen.findByTestId('card-add-money-address')
        // the earlier deposit lands and covers the gap
        live = 10
        await act(async () => void jest.advanceTimersByTime(15_000))
        expect(await screen.findByTestId('card-add-money-done')).toBeInTheDocument()
        expect(screen.queryByTestId('qr')).not.toBeInTheDocument()
    })

    it('resolves on its own when the deposit lands after the wait, with no tap', async () => {
        jest.useFakeTimers()
        pollStatus = 'completed'
        pollCompletedAmount = 4
        renderView()
        await waitFor(() => expect(mockResetStatus).toHaveBeenCalled())
        await aMinuteOfReads()
        expect(screen.getByTestId('card-add-money-send-more')).toBeInTheDocument()
        live = 6.5
        await nextRead()
        await nextRead()
        expect(await screen.findByTestId('card-add-money-short')).toHaveTextContent('shortReceived($4)')
    })

    it('waits for the deposit when the read at open does not include it yet', async () => {
        jest.useFakeTimers()
        pollStatus = 'completed'
        pollCompletedAmount = 4
        renderView()
        await waitFor(() => expect(mockResetStatus).toHaveBeenCalled())
        expect(screen.queryByTestId('qr')).not.toBeInTheDocument()
        // the next fresh read has it (the first hold read ran at once, with the open's balance)
        live = 6.5
        await nextRead()
        await nextRead()
        expect(await screen.findByTestId('card-add-money-short')).toHaveTextContent('shortReceived($4)')
    })

    it('offers a retry when it cannot be cleared, and clears again on retry', async () => {
        jest.useFakeTimers()
        pollStatus = 'completed'
        resetFails = true
        renderView()
        await waitFor(() => expect(mockResetStatus).toHaveBeenCalled())
        await aMinuteOfReads()
        // the user chooses to send more: the old outcome must be cleared first, and that fails
        fireEvent.click(screen.getByTestId('card-add-money-send-more'))
        expect(await screen.findByTestId('card-add-money-check-failed')).toBeInTheDocument()
        expect(screen.queryByTestId('qr')).not.toBeInTheDocument()
        resetFails = false
        fireEvent.click(screen.getByText('retry'))
        expect(await screen.findByTestId('card-add-money-address')).toBeInTheDocument()
        // at open, on the choice to send more, and on the retry
        expect(mockResetStatus).toHaveBeenCalledTimes(3)
    })
})

describe('a completed outcome found at open, edge paths (review of round 4)', () => {
    it('never counts a failed read toward the release', async () => {
        jest.useFakeTimers()
        pollStatus = 'completed'
        renderView()
        await waitFor(() => expect(mockResetStatus).toHaveBeenCalled())
        liveFails = true
        await aMinuteOfReads()
        await aMinuteOfReads()
        expect(screen.queryByTestId('qr')).not.toBeInTheDocument()
    })

    it('acts on the status as it stands after the read at open, not the first answer', async () => {
        jest.useFakeTimers()
        let release: () => void = () => {}
        liveGate = new Promise((resolve) => (release = resolve))
        const view = renderView()
        await waitFor(() => expect(mockReadLive).toHaveBeenCalled())
        // a deposit completes while the balance is read
        pollStatus = 'completed'
        view.rerender()
        liveGate = null
        await act(async () => release())
        await waitFor(() => expect(mockResetStatus).toHaveBeenCalled())
        expect(screen.queryByTestId('qr')).not.toBeInTheDocument()
        live = 6.5
        await nextRead()
        await nextRead()
        expect(await screen.findByTestId('card-add-money-short')).toHaveTextContent('shortReceived($4)')
    })

    it('treats the old outcome written back after a clear as the old deposit: capped, not counted again', async () => {
        jest.useFakeTimers()
        pollStatus = 'completed'
        pollCompletedAmount = 7.5
        renderView()
        await waitFor(() => expect(mockResetStatus).toHaveBeenCalledTimes(1))
        await aMinuteOfReads()
        fireEvent.click(screen.getByTestId('card-add-money-send-more'))
        await screen.findByTestId('card-add-money-address')
        // the backend writes the same completed outcome back
        pollStatus = 'completed'
        await act(async () => pollOnSuccess?.(7.5))
        expect(screen.getByTestId('card-add-money-processing')).toBeInTheDocument()
        await aMinuteOfReads()
        expect(screen.queryByTestId('qr')).not.toBeInTheDocument()
        fireEvent.click(screen.getByTestId('card-add-money-send-more'))
        expect(await screen.findByTestId('card-add-money-address')).toBeInTheDocument()
        expect(deposits()).toHaveLength(1)
    })
})

describe('a deposit made while the address shows', () => {
    it('holds processing until a fresh read shows it, then names what is still missing', async () => {
        jest.useFakeTimers()
        renderView()
        await screen.findByTestId('card-add-money-address')
        pollStatus = 'completed'
        await act(async () => pollOnSuccess?.(4))
        expect(screen.getByTestId('card-add-money-processing')).toBeInTheDocument()
        expect(onProcessingChange).toHaveBeenLastCalledWith(true)
        live = 6.5
        await nextRead()
        const short = await screen.findByTestId('card-add-money-short')
        expect(short).toHaveTextContent('shortReceived($4)')
        expect(short).toHaveTextContent('shortStillNeeded($3.50)')
        // never "send it" in the notice: the ask below is raised to the $5 minimum and says why
        expect(short).not.toHaveTextContent(/send/i)
        const ask = screen.getByTestId('card-add-money-ask')
        expect(ask).toHaveTextContent('sendAsk($5)')
        expect(ask).toHaveTextContent('raisedToMinimum(Tron|$5|$1.50)')
        // the poll is re-armed for the rest
        expect(mockResetStatus).toHaveBeenCalledTimes(1)
    })

    it('does not show the address after a re-arm until the API answers again', async () => {
        jest.useFakeTimers()
        mockResetStatus.mockImplementationOnce(async () => {
            pollStatus = 'not_started'
            // the clear's own "not started" is not an answer of the API's
            pollRead = false
        })
        const view = renderView()
        await screen.findByTestId('card-add-money-address')
        pollStatus = 'completed'
        await act(async () => pollOnSuccess?.(4))
        live = 6.5
        await nextRead()
        await waitFor(() => expect(mockResetStatus).toHaveBeenCalled())
        expect(screen.queryByTestId('qr')).not.toBeInTheDocument()
        pollRead = true
        view.rerender()
        expect(await screen.findByTestId('card-add-money-short')).toBeInTheDocument()
    })

    it('asks for the exact rest when the minimum is lower', async () => {
        jest.useFakeTimers()
        mockCreateDepositAddress.mockResolvedValue({ depositAddress: ADDRESS, minDepositLimitUsd: 1 })
        renderView()
        await screen.findByTestId('card-add-money-address')
        await act(async () => pollOnSuccess?.(4))
        live = 6.5
        await nextRead()
        expect(await screen.findByTestId('card-add-money-ask')).toHaveTextContent('sendAsk($3.50)')
    })

    it('re-arms the poll after a second short deposit of the same amount', async () => {
        jest.useFakeTimers()
        mockCreateDepositAddress.mockResolvedValue({ depositAddress: ADDRESS, minDepositLimitUsd: 1 })
        live = 1
        renderView()
        await screen.findByTestId('card-add-money-address')
        pollStatus = 'completed'
        await act(async () => pollOnSuccess?.(4))
        live = 5
        await nextRead()
        await screen.findByTestId('card-add-money-short')
        expect(mockResetStatus).toHaveBeenCalledTimes(1)
        pollStatus = 'completed'
        await act(async () => pollOnSuccess?.(4))
        live = 9
        await nextRead()
        await waitFor(() => expect(mockResetStatus).toHaveBeenCalledTimes(2))
        expect(await screen.findByTestId('card-add-money-short')).toHaveTextContent('shortReceived($4)')
    })

    it('says done when a fresh read covers the gap, and tells the drawer it settled', async () => {
        jest.useFakeTimers()
        renderView()
        await screen.findByTestId('card-add-money-address')
        await act(async () => pollOnSuccess?.(7.5))
        live = 10
        await nextRead()
        expect(await screen.findByTestId('card-add-money-done')).toBeInTheDocument()
        expect(onProcessingChange).toHaveBeenLastCalledWith(false)
        expect(deposits()).toHaveLength(1)
    })

    it('does not count a rise under half a cent as the deposit', async () => {
        jest.useFakeTimers()
        renderView()
        await screen.findByTestId('card-add-money-address')
        pollStatus = 'completed'
        await act(async () => pollOnSuccess?.(7.5))
        live = 2.504
        await nextRead()
        await nextRead()
        expect(screen.getByTestId('card-add-money-processing')).toBeInTheDocument()
    })
})

describe('the address view', () => {
    it('shortens the address in the middle, keeps the last 4, and copies all of it', async () => {
        renderView()
        await screen.findByTestId('card-add-money-address')
        const field = screen.getByDisplayValue(/…/) as HTMLInputElement
        expect(field.value.endsWith('beef')).toBe(true)
        expect(field.value.startsWith('0x1234')).toBe(true)
        await act(async () => fireEvent.click(screen.getByText('copyField.copy')))
        expect(mockCopy).toHaveBeenCalledWith(ADDRESS)
    })

    it('names the EVM family, not "EVM", in the minimum note', async () => {
        live = 8
        renderView('EVM')
        expect(await screen.findByTestId('card-add-money-ask')).toHaveTextContent('raisedToMinimum(evmNetworks|$5|$3)')
    })

    it('names a state in body text, not a second heading', async () => {
        jest.useFakeTimers()
        renderView()
        await screen.findByTestId('card-add-money-address')
        await act(async () => pollOnSuccess?.(7.5))
        const processing = screen.getByTestId('card-add-money-processing')
        expect(processing.querySelector('[class*="text-heading"]')).toBeNull()
    })
})
