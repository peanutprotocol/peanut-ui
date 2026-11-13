/** @jest-environment jsdom */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'

/**
 * The ending of a Pix payout through Bridge (ruling D7, API-CONTRACT.md section 6): it takes about
 * 3 to 5 minutes, so the screen never holds the user on the loader. On its way at once, with who
 * it goes to, when it usually lands and Done; then paid, returned or failed as the entry moves. A
 * payout to another person's key reads as a send to them.
 */
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
    usePathname: () => '/withdraw/pix',
    useSearchParams: () => new URLSearchParams(),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'u1' }, invitedBy: null } }),
}))
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsSupportModalOpen: jest.fn() }),
    useModalsContextOptional: () => null,
}))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn(), useReturnTo: () => jest.fn() }))
jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: ({ title }: { title?: string }) => <div data-testid="nav-header">{title}</div>,
}))
jest.mock('@/components/Global/Loading', () => ({
    __esModule: true,
    default: () => <div data-testid="mascot-loader" />,
}))
jest.mock('@/components/Global/SoundPlayer', () => ({ SoundPlayer: () => <div data-testid="success-sound" /> }))
jest.mock('@/components/Provider/ProviderFinePrint', () => ({
    ProviderFinePrint: ({ providerId }: { providerId: string }) => <div>provider {providerId}</div>,
}))
const mockEntry = jest.fn()
jest.mock('@/hooks/useHistoryEntry', () => ({ useHistoryEntry: () => mockEntry() }))
// the shared success view's media and side effects, which jsdom cannot render
jest.mock('@/components/Global/PeanutMascot', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/TransactionDetails/TransactionDetailsDrawer', () => ({
    TransactionDetailsDrawer: () => null,
}))
jest.mock('@/hooks/useTransactionDetailsDrawer', () => ({
    useTransactionDetailsDrawer: () => ({
        selectedTxId: null,
        isTransactionSelected: () => false,
        openTransactionDetails: jest.fn(),
        closeTransactionDetails: jest.fn(),
    }),
}))
jest.mock('@/hooks/useTokenChainIcons', () => ({
    useTokenChainIcons: () => ({ tokenIconUrl: undefined, chainIconUrl: undefined }),
}))
jest.mock('@/hooks/usePointsConfetti', () => ({ usePointsConfetti: () => undefined }))
jest.mock('@/hooks/useAppReviewNudge', () => ({ useAppReviewNudge: () => undefined }))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => false }))

import { PixWithdrawOutcome } from '../components/PixWithdrawOutcome'

const display = {
    amountBrl: '100.00',
    pixKey: '11144477735',
    ownAccount: false,
    holderName: 'BRUNO LIMA',
    bankName: 'Nu Pagamentos S.A.',
    withdrawUsd: '18.87',
    rate: '5.30',
    fixedFeeBrl: '0',
    arrivalEstimateSeconds: 300,
    provider: 'Bridge',
    amountBrlEstimated: true as const,
}
// GET /history/:id for a Bridge payout, as peanut-api-ts src/db/history.ts writes it
const entry = (status: string, overrides: Record<string, unknown> = {}) => ({
    data: {
        uuid: 'b1',
        type: 'TRANSACTION_INTENT',
        timestamp: new Date('2026-11-14T10:00:00.000Z'),
        amount: '18.87',
        chainId: 'arbitrum',
        tokenSymbol: 'USDC',
        tokenAddress: '',
        status,
        userRole: 'SENDER',
        senderAccount: { identifier: '0xabc', type: 'peanut-wallet', isUser: true, username: 'ana' },
        recipientAccount: { identifier: '11144477735', type: 'BANK_PIX', isUser: false, fullName: 'BRUNO LIMA' },
        currency: { amount: '100.00', code: 'brl' },
        extraData: {
            kind: 'OFFRAMP',
            provider: 'BRIDGE',
            bridgeFlow: 'OFFRAMP',
            fulfillmentType: 'bridge',
            pixPayee: 'other',
        },
        ...overrides,
    },
    isLoading: false,
})
const renderOutcome = (sent: Parameters<typeof PixWithdrawOutcome>[0]['sent']) =>
    renderWithIntl(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <PixWithdrawOutcome
                title="Send"
                intentId="b1"
                providerId="bridge"
                sent={sent}
                onStartAgain={jest.fn()}
                onDone={jest.fn()}
            />
        </QueryClientProvider>
    )
const funded = { phase: 'funded' as const, display }

describe('PixWithdrawOutcome for a Bridge payout', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.useFakeTimers()
    })
    afterEach(() => jest.useRealTimers())

    it('is on its way at once: the amount marked approximate, who it goes to, when it lands, and Done', () => {
        mockEntry.mockReturnValue(entry('AWAITING_FUNDS'))
        renderOutcome(funded)

        expect(screen.queryByTestId('mascot-loader')).toBeNull()
        expect(screen.getByText('≈ R$100')).toBeInTheDocument()
        expect(
            screen.getByText(
                `${en.pix.withdraw.sentTo.replace('{destination}', 'Nu Pagamentos S.A. · BRUNO LIMA')} Usually arrives in about 5 minutes.`
            )
        ).toBeInTheDocument()
        expect(screen.getByRole('button', { name: en.common.done })).toBeInTheDocument()
        expect(screen.getByText('provider bridge')).toBeInTheDocument()
    })

    it('stays on its way while Bridge pays, with no loader at any time', () => {
        mockEntry.mockReturnValue(entry('PAYMENT_SUBMITTED'))
        renderOutcome(funded)
        act(() => jest.advanceTimersByTime(10 * 60_000))
        expect(screen.queryByTestId('mascot-loader')).toBeNull()
        expect(screen.getByRole('button', { name: en.common.done })).toBeInTheDocument()
    })

    it("turns to the paid state at PAYMENT_PROCESSED, as a send to the person, with Bridge's final reais", () => {
        mockEntry.mockReturnValue(entry('AWAITING_FUNDS'))
        const view = renderOutcome(funded)
        mockEntry.mockReturnValue(entry('PAYMENT_PROCESSED', { currency: { amount: '99.80', code: 'brl' } }))
        view.rerender(
            <QueryClientProvider client={new QueryClient()}>
                <PixWithdrawOutcome
                    title="Send"
                    intentId="b1"
                    providerId="bridge"
                    sent={funded}
                    onStartAgain={jest.fn()}
                    onDone={jest.fn()}
                />
            </QueryClientProvider>
        )

        expect(screen.getByText(en.payment.success.justSent)).toBeInTheDocument()
        expect(screen.getByText('R$99.80')).toBeInTheDocument()
        expect(screen.getByText('to BRUNO LIMA')).toBeInTheDocument()
        expect(screen.queryByText(en.payment.success.withdrew)).toBeNull()
    })

    it('reads a payout to the own key as a withdrawal once paid', () => {
        mockEntry.mockReturnValue(
            entry('PAYMENT_PROCESSED', { extraData: { kind: 'OFFRAMP', provider: 'BRIDGE', pixPayee: 'own' } })
        )
        renderOutcome({ phase: 'funded', display: { ...display, ownAccount: true, holderName: 'ANA SOUZA' } })
        expect(screen.getByText(en.payment.success.withdrew)).toBeInTheDocument()
        expect(screen.getByText('to your Pix key 11144477735 at Nu Pagamentos S.A.')).toBeInTheDocument()
    })

    it('says a returned payout is back in the balance, and a failed one goes to support', () => {
        mockEntry.mockReturnValue(entry('RETURNED'))
        const returned = renderOutcome(funded)
        expect(screen.getByText(en.pix.withdraw.refunded)).toBeInTheDocument()
        returned.unmount()

        mockEntry.mockReturnValue(entry('UNDELIVERABLE'))
        renderOutcome(funded)
        expect(screen.getByText(en.pix.withdraw.stuck)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: en.common.contactSupport })).toBeInTheDocument()
    })

    it('after a reload, reads the payout from its entry: on its way, to the person, with no loader', () => {
        mockEntry.mockReturnValue(entry('FUNDS_RECEIVED'))
        renderOutcome(null)
        expect(screen.queryByTestId('mascot-loader')).toBeNull()
        expect(screen.getByText('≈ R$100')).toBeInTheDocument()
        expect(
            screen.getByText(
                `${en.pix.withdraw.sentTo.replace('{destination}', 'BRUNO LIMA')} ${en.exchangeRate.widget.arrivesMinutes}`
            )
        ).toBeInTheDocument()
    })

    // a 502 on the submit: the outcome is unknown, so the screen reads the withdrawal and offers no new signature
    it('reads an unconfirmed submit from the entry and offers no way to sign again', () => {
        mockEntry.mockReturnValue(entry('AWAITING_FUNDS'))
        renderOutcome({ phase: 'unconfirmed', display })
        expect(screen.getByText(en.pix.withdraw.unconfirmed)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: en.common.tryAgain })).toBeNull()
        expect(screen.getByRole('button', { name: en.common.done })).toBeInTheDocument()
    })
})
