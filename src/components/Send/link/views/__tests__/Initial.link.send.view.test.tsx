/**
 * LinkSendInitialView — error-state ownership tests
 *
 * The balance-gate useEffect and submit-time failures (Rain cooldown 425,
 * settling copy) share one errorState slot. Regression suite for the
 * "error message disappears" bug: right after a collateral spend the polled
 * spendable balance oscillates around the typed amount, and the gate was
 * overwriting the submit-time error with INSUFFICIENT_BALANCE_MESSAGE on the
 * dip, then clearing it on the recovery — silently swallowing the real error.
 * (PostHog session 019f8f8c-d4d5-775c-97ab-3e47c532a694, 2026-07-23.)
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LinkSendFlowProvider, useLinkSendFlow } from '@/context/LinkSendFlowContext'
import { INSUFFICIENT_BALANCE_MESSAGE } from '@/utils/balance.utils'

const COOLDOWN_MESSAGE = 'A previous withdrawal signature is still active. Try again in about 2 min.'

// ---------- module mocks ----------

jest.mock('@/context/loadingStates.context', () => {
    const ReactActual = jest.requireActual('react')
    return {
        loadingStateContext: ReactActual.createContext({
            loadingState: 'Idle',
            setLoadingState: jest.fn(),
            isLoading: false,
        }),
    }
})

const mockCreateLink = jest.fn()
jest.mock('@/components/Create/useCreateLink', () => ({
    useCreateLink: () => ({ createLink: mockCreateLink }),
}))

const mockUseWallet = jest.fn()
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => mockUseWallet(),
}))

jest.mock('@/hooks/wallet/usePendingTransactions', () => ({
    usePendingTransactions: () => ({ hasPendingTransactions: false, pendingCount: 0 }),
}))

jest.mock('@/services/sendLinks', () => ({
    sendLinksApi: { create: jest.fn().mockResolvedValue({}) },
}))

jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: jest.fn() },
}))

jest.mock('@sentry/nextjs', () => ({
    captureException: jest.fn(),
}))

jest.mock('@/components/Global/PeanutActionCard', () => ({
    __esModule: true,
    default: () => <div data-testid="action-card" />,
}))

jest.mock('@/components/Global/FileUploadInput', () => ({
    __esModule: true,
    default: () => <div data-testid="file-upload" />,
}))

jest.mock('@/components/Global/AmountInput', () => ({
    __esModule: true,
    default: () => <div data-testid="amount-input" />,
}))

jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({
        children,
        onClick,
        disabled,
    }: {
        children?: React.ReactNode
        onClick?: () => void
        disabled?: boolean
    }) => (
        <button onClick={onClick} disabled={disabled}>
            {children}
        </button>
    ),
}))

jest.mock('@/components/Global/ErrorAlert', () => ({
    __esModule: true,
    default: ({ description }: { description: string }) => <div data-testid="error-alert">{description}</div>,
}))

import LinkSendInitialView from '../Initial.link.send.view'

// ---------- helpers ----------

const usdc = (dollars: number) => BigInt(Math.round(dollars * 1e6))

const walletState = (spendableDollars: number) => ({
    fetchBalance: jest.fn(),
    spendableBalance: usdc(spendableDollars),
    formattedSpendableBalance: spendableDollars.toFixed(2),
})

/** Drives the flow context from inside the provider (AmountInput is mocked out). */
const SetAmount = ({ amount }: { amount: string }) => {
    const { setTokenValue } = useLinkSendFlow()
    return (
        <button data-testid="set-amount" onClick={() => setTokenValue(amount)}>
            set
        </button>
    )
}

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

const viewTree = (amount: string) => (
    <QueryClientProvider client={queryClient}>
        <LinkSendFlowProvider>
            <SetAmount amount={amount} />
            <LinkSendInitialView />
        </LinkSendFlowProvider>
    </QueryClientProvider>
)

const renderView = (amount: string) => {
    const utils = render(viewTree(amount))
    fireEvent.click(screen.getByTestId('set-amount'))
    return utils
}

const rerenderView = (utils: ReturnType<typeof render>, amount: string) => {
    utils.rerender(viewTree(amount))
}

beforeEach(() => {
    jest.clearAllMocks()
})

// ---------- tests ----------

describe('LinkSendInitialView error ownership', () => {
    test('submit-time error survives a balance dip below the amount (gate must not overwrite it)', async () => {
        mockUseWallet.mockReturnValue(walletState(100))
        mockCreateLink.mockRejectedValue(new Error(COOLDOWN_MESSAGE))

        const utils = renderView('20')
        fireEvent.click(screen.getByText('Create link'))
        await waitFor(() => expect(screen.getByTestId('error-alert')).toHaveTextContent(COOLDOWN_MESSAGE))

        // balance poll settles below the amount — the cooldown copy must stay
        mockUseWallet.mockReturnValue(walletState(10))
        rerenderView(utils, '20')
        expect(screen.getByTestId('error-alert')).toHaveTextContent(COOLDOWN_MESSAGE)

        // next poll recovers above the amount — still must not be cleared
        mockUseWallet.mockReturnValue(walletState(100))
        rerenderView(utils, '20')
        expect(screen.getByTestId('error-alert')).toHaveTextContent(COOLDOWN_MESSAGE)
    })

    test('balance-gate error appears on shortfall and clears on recovery when no submit error is showing', async () => {
        mockUseWallet.mockReturnValue(walletState(10))

        const utils = renderView('20')
        await waitFor(() => expect(screen.getByTestId('error-alert')).toHaveTextContent(INSUFFICIENT_BALANCE_MESSAGE))

        mockUseWallet.mockReturnValue(walletState(100))
        rerenderView(utils, '20')
        await waitFor(() => expect(screen.queryByTestId('error-alert')).not.toBeInTheDocument())
    })
})
