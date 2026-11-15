/** @jest-environment jsdom */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import { PAYMENT_LOADING_WORD_KEYS } from '@/components/Global/Loading/words'

/**
 * The two endings a Pix withdrawal shares with every other withdrawal (ruling
 * 2026-11-12): the payment loader while the provider pays, bounded by the
 * quoted arrival time, and the shared success view once the Pix landed. The
 * failure endings keep their own screen.
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
// a send's own read (its QR reward) and the QR lane's points estimate (ruling of 15 Nov)
const mockReadWithdrawal = jest.fn()
jest.mock('@/services/pix', () => ({ pixApi: { readWithdrawal: (id: string) => mockReadWithdrawal(id) } }))
const mockCalculatePoints = jest.fn()
jest.mock('@/services/points', () => ({ pointsApi: { calculatePoints: (r: unknown) => mockCalculatePoints(r) } }))
jest.mock('@/components/Common/PointsCard', () => ({
    __esModule: true,
    default: ({ points }: { points: number }) => <div>points {points}</div>,
}))

import { PixWithdrawOutcome } from '../components/PixWithdrawOutcome'

const display = {
    amountBrl: '503.00',
    pixKey: '09579927189',
    ownAccount: true as boolean | null,
    holderTaxIdMasked: null,
    holderName: 'Ana Souza',
    bankName: 'Banco Inter',
    withdrawUsd: '92.504310',
    rate: '5.445692',
    fixedFeeBrl: '0.75',
    arrivalEstimateSeconds: 60,
    provider: 'Avenia' as const,
}
// GET /history/:id for the withdrawal, as the API sends it
const entry = (status: string, intentStatus?: string) => ({
    data: {
        uuid: 'w1',
        type: 'TRANSACTION_INTENT',
        timestamp: new Date('2026-11-12T10:00:00.000Z'),
        amount: '92.50431',
        chainId: '42161',
        tokenSymbol: 'USDC',
        tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        status,
        userRole: 'SENDER',
        senderAccount: { identifier: 'demo', type: 'PEANUT_WALLET', isUser: true, username: 'demo' },
        recipientAccount: { identifier: '+5511912345678', fullName: 'ANA SOUZA', type: 'PIX', isUser: false },
        currency: { amount: '503.00', code: 'BRL' },
        extraData: { kind: 'OFFRAMP', provider: 'AVENIA', usdAmount: '92.50431', pixRecovery: null, intentStatus },
    },
    isLoading: false,
})
const CAPTIONS = PAYMENT_LOADING_WORD_KEYS.map((key) => `${en.paymentLoading[key]}...`)

const renderOutcome = (
    sent: Parameters<typeof PixWithdrawOutcome>[0]['sent'],
    providerId: Parameters<typeof PixWithdrawOutcome>[0]['providerId'] = 'avenia-br'
) =>
    renderWithIntl(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <PixWithdrawOutcome
                title="Withdraw"
                intentId="w1"
                providerId={providerId}
                sent={sent}
                onStartAgain={jest.fn()}
                onDone={jest.fn()}
            />
        </QueryClientProvider>
    )
const funded = { phase: 'funded' as const, display }

describe('PixWithdrawOutcome while the provider pays', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.useFakeTimers()
    })
    afterEach(() => jest.useRealTimers())

    it('shows the shared payment loader under the withdrawal title, with no Done and no sound', () => {
        mockEntry.mockReturnValue(entry('PENDING', 'PROCESSING'))
        renderOutcome(funded)

        expect(screen.getByTestId('mascot-loader')).toBeInTheDocument()
        expect(screen.getByText(en.pix.withdraw.processingTitle)).toBeInTheDocument()
        expect(screen.getByText((text) => CAPTIONS.includes(text))).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: en.common.done })).toBeNull()
        expect(screen.queryByTestId('success-sound')).toBeNull()
    })

    it('falls back to "on its way" with Done once the quoted arrival time has passed', () => {
        mockEntry.mockReturnValue(entry('PENDING', 'PROCESSING'))
        renderOutcome(funded)

        act(() => jest.advanceTimersByTime(59_999))
        expect(screen.getByTestId('mascot-loader')).toBeInTheDocument()

        act(() => jest.advanceTimersByTime(1))
        expect(screen.queryByTestId('mascot-loader')).toBeNull()
        expect(
            screen.getByText(en.pix.withdraw.sentTo.replace('{destination}', 'Banco Inter · Ana Souza'))
        ).toBeInTheDocument()
        expect(screen.getByText('R$503')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: en.common.done })).toBeInTheDocument()
    })

    // a reload has no quote: the loader lasts 90 s, then names no destination
    it('after a reload, falls back after 90 seconds to "on its way" without a destination', () => {
        mockEntry.mockReturnValue(entry('PENDING', 'PROCESSING'))
        renderOutcome(null)

        expect(screen.getByText(en.pix.withdraw.processingTitle)).toBeInTheDocument()
        act(() => jest.advanceTimersByTime(90_000))

        expect(screen.getByText(en.pix.withdraw.sent)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: en.common.done })).toBeInTheDocument()
    })

    it('moves to the success view when the entry completes before the arrival time', () => {
        mockEntry.mockReturnValue(entry('PENDING', 'PROCESSING'))
        const view = renderOutcome(funded)
        act(() => jest.advanceTimersByTime(30_000))

        mockEntry.mockReturnValue(entry('COMPLETED'))
        view.rerender(
            <QueryClientProvider client={new QueryClient()}>
                <PixWithdrawOutcome
                    title="Withdraw"
                    intentId="w1"
                    providerId="avenia-br"
                    sent={funded}
                    onStartAgain={jest.fn()}
                    onDone={jest.fn()}
                />
            </QueryClientProvider>
        )

        expect(screen.getByText(en.payment.success.withdrew)).toBeInTheDocument()
        expect(screen.queryByTestId('mascot-loader')).toBeNull()
    })
})

describe('PixWithdrawOutcome once the Pix landed', () => {
    beforeEach(() => jest.clearAllMocks())

    it('shows the shared success view: Withdrawn, the reais over the USD, the key at the bank, one sound', () => {
        mockEntry.mockReturnValue(entry('COMPLETED'))
        renderOutcome(funded)

        expect(screen.getByText(en.payment.success.withdrew)).toBeInTheDocument()
        expect(screen.getByText('R$503')).toBeInTheDocument()
        expect(screen.getByText('$92.50')).toBeInTheDocument()
        expect(screen.getByText('to your Pix key 095.799.271-89 at Banco Inter')).toBeInTheDocument()
        expect(screen.getAllByTestId('success-sound')).toHaveLength(1)
        expect(screen.getByRole('button', { name: en.payment.success.backToHome })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: en.payment.success.seeReceipt })).toBeInTheDocument()
        expect(screen.getByText('provider avenia-br')).toBeInTheDocument()
        expect(
            screen.queryByText(en.pix.withdraw.sentTo.replace('{destination}', 'Banco Inter · Ana Souza'))
        ).toBeNull()
    })

    // the view is the one page shell: a shell around it stacked two min-h-inherit regions and pushed the
    // card down (Chip on 37aafd073)
    it('renders the success view as the one page shell, with its own header', () => {
        mockEntry.mockReturnValue(entry('COMPLETED'))
        const { container } = renderOutcome(funded)

        expect(container.querySelectorAll('.min-h-inherit')).toHaveLength(1)
        expect(screen.getAllByTestId('nav-header')).toHaveLength(1)
        expect(screen.getByTestId('nav-header')).toHaveTextContent('Withdraw')
    })

    it('names the key alone when the directory named no bank', () => {
        mockEntry.mockReturnValue(entry('COMPLETED'))
        renderOutcome({ phase: 'funded', display: { ...display, bankName: null, holderName: null } })

        expect(screen.getByText('to your Pix key 095.799.271-89')).toBeInTheDocument()
    })

    // TASK-24947: a payout to another person's key ends as a send to them
    it("ends a payout to another person's key as Sent, to the holder by name", () => {
        mockEntry.mockReturnValue(entry('COMPLETED'))
        renderOutcome({ phase: 'funded', display: { ...display, ownAccount: false, holderName: 'Bruno Lima' } })

        expect(screen.getByText(en.payment.success.justSent)).toBeInTheDocument()
        expect(screen.queryByText(en.payment.success.withdrew)).toBeNull()
        expect(screen.getByText('to Bruno Lima')).toBeInTheDocument()
    })

    // API-CONTRACT-M3 §8: after a reload the entry's payout says whom it paid
    it("after a reload, ends a payout to another person's key as Sent, by the entry's payout", () => {
        const paid = entry('COMPLETED')
        mockEntry.mockReturnValue({
            ...paid,
            data: {
                ...paid.data,
                extraData: {
                    ...paid.data.extraData,
                    pixPayout: {
                        pixKey: '+5511987654321',
                        holderName: 'Bruno Lima',
                        bankName: 'Nubank',
                        ownAccount: false,
                    },
                },
            },
        })
        renderOutcome(null)

        expect(screen.getByText(en.payment.success.justSent)).toBeInTheDocument()
        expect(screen.getByText('to Bruno Lima')).toBeInTheDocument()
    })

    // after a reload the entry is all the screen has: its reais, its USD, its key, and no bank
    it('after a reload, reads the amounts and the key from the history entry', () => {
        mockEntry.mockReturnValue(entry('COMPLETED'))
        renderOutcome(null)

        expect(screen.getByText(en.payment.success.withdrew)).toBeInTheDocument()
        expect(screen.getByText('R$503')).toBeInTheDocument()
        expect(screen.getByText('$92.50')).toBeInTheDocument()
        expect(screen.getByText('to your Pix key 11 91234-5678')).toBeInTheDocument()
    })
})

describe('PixWithdrawOutcome failure endings', () => {
    beforeEach(() => jest.clearAllMocks())

    it('keeps its own screen for a refused payout', () => {
        mockEntry.mockReturnValue(entry('REFUNDED'))
        renderOutcome(funded)

        expect(screen.getByText(en.pix.withdraw.refunded)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: en.common.done })).toBeInTheDocument()
        expect(screen.queryByText(en.payment.success.withdrew)).toBeNull()
        expect(screen.queryByTestId('success-sound')).toBeNull()
    })

    // Chip: the route can name another provider by the time an ?intentId= link opens; the entry is the truth
    it('names the provider that opened the withdrawal, not the one the route names now', () => {
        mockEntry.mockReturnValue(entry('REFUNDED'))
        renderOutcome(null, 'manteca-br')

        expect(screen.getByText('provider avenia-br')).toBeInTheDocument()
        expect(screen.queryByText('provider manteca-br')).toBeNull()
    })

    it('shows no provider row after a reload when the entry names none', () => {
        const unnamed = entry('REFUNDED')
        mockEntry.mockReturnValue({
            ...unnamed,
            data: { ...unnamed.data, extraData: { ...unnamed.data.extraData, provider: undefined } },
        })
        renderOutcome(null, 'manteca-br')

        expect(screen.queryByText(/^provider /)).toBeNull()
    })
})

// The owner's ruling of 15 Nov: a send to another person's key earns what Manteca's key send earned,
// shown with the QR success's reward card and hold-to-claim (GET /pix/withdraw/:intentId's `perk`)
describe("PixWithdrawOutcome: a send's QR reward", () => {
    const perk = {
        eligible: true as const,
        discountPercentage: 0,
        claimed: false as const,
        sponsoredUsd: 1,
        reason: 'Pix cashback',
        usageId: 'usage-1',
        payoutStatus: 'pending' as const,
    }
    const read = (state: string, withPerk: Record<string, unknown> | null = perk) => ({
        provider: 'avenia',
        intentId: 'w1',
        state,
        status: 'COMPLETED',
        amountBrl: '503.00',
        holderName: 'Bruno Lima',
        ownAccount: false,
        perk: withPerk,
    })
    const toBruno = { phase: 'funded' as const, display: { ...display, ownAccount: false, holderName: 'Bruno Lima' } }
    // the hold's label is drawn twice (under and over its fill)
    const holdButton = () => screen.queryAllByText(en.qrPay.success.claimReward)[0] ?? null

    beforeEach(() => {
        jest.clearAllMocks()
        mockEntry.mockReturnValue(entry('COMPLETED'))
        mockCalculatePoints.mockResolvedValue({ estimatedPoints: 46 })
    })

    it('a paid send with a reward: the reward card and the hold, in place of the points and the other CTAs', async () => {
        mockReadWithdrawal.mockResolvedValue(read('paid'))
        renderOutcome(toBruno)

        expect(await screen.findByText(en.qrPay.success.earnedRewardTitle)).toBeInTheDocument()
        expect(mockReadWithdrawal).toHaveBeenCalledWith('w1')
        expect(holdButton()).toBeInTheDocument()
        expect(screen.queryByText('points 46')).toBeNull()
        expect(screen.queryByRole('button', { name: en.payment.success.backToHome })).toBeNull()
    })

    it('a reward already paid out reads as claimed: its banner, no hold', async () => {
        mockReadWithdrawal.mockResolvedValue(read('paid', { ...perk, payoutStatus: 'completed', txHash: '0xab' }))
        renderOutcome(toBruno)

        expect(await screen.findByText(en.qrPay.success.earnedRewardTitle)).toBeInTheDocument()
        expect(holdButton()).toBeNull()
        expect(screen.getByRole('button', { name: en.payment.success.backToHome })).toBeInTheDocument()
    })

    it('a send whose read is not paid (refunded) shows no reward, only its points', async () => {
        mockReadWithdrawal.mockResolvedValue(read('refunded'))
        renderOutcome(toBruno)

        expect(await screen.findByText('points 46')).toBeInTheDocument()
        expect(screen.queryByText(en.qrPay.success.earnedRewardTitle)).toBeNull()
        expect(holdButton()).toBeNull()
    })

    it('a paid send no campaign rewards shows the QR lane points', async () => {
        mockReadWithdrawal.mockResolvedValue(read('paid', null))
        renderOutcome(toBruno)

        expect(await screen.findByText('points 46')).toBeInTheDocument()
        expect(mockCalculatePoints).toHaveBeenCalledWith({ actionType: 'MANTECA_QR_PAYMENT', usdAmount: 92.50431 })
    })

    it('a payout to the user’s own key reads no reward and shows no QR points', async () => {
        renderOutcome(funded)

        expect(await screen.findByText(en.payment.success.withdrew)).toBeInTheDocument()
        await waitFor(() => expect(mockReadWithdrawal).not.toHaveBeenCalled())
        expect(mockCalculatePoints).not.toHaveBeenCalled()
        expect(screen.queryByText(en.qrPay.success.earnedRewardTitle)).toBeNull()
    })
})
