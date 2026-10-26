/**
 * The success screen's receipt states the network fee the backend settled,
 * never a placeholder (TASK-23487). It used to print "Network fee $0" from a
 * hardcoded string while Rhino deducted a real fee on every network.
 *
 * Once the charge's history entry loads, its amount, status and fee go over the
 * receipt the flow built. The flow's receipt keeps what the history projection
 * does not carry: the comment and the attachment.
 */

import { render } from '@testing-library/react'
import type { TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import PaymentSuccessView from '@/features/payments/shared/components/PaymentSuccessView'
import type { PaymentCreationResponse, TChargeTransactionType, TRequestChargeResponse } from '@/services/services.types'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import type { HistoryEntry } from '@/utils/history.utils'

const capturedTransactions: Array<TransactionDetails | null | undefined> = []
const lastReceipt = () => capturedTransactions.filter((tx) => tx != null).at(-1)!

jest.mock('@/assets', () => ({}))
jest.mock('@/assets/payment-apps', () => ({ MERCADO_PAGO: '', PIX: '' }))

jest.mock('@/components/TransactionDetails/TransactionDetailsDrawer', () => ({
    TransactionDetailsDrawer: ({ transaction }: { transaction: TransactionDetails | null }) => {
        capturedTransactions.push(transaction)
        return null
    },
}))

jest.mock('@/hooks/useTransactionDetailsDrawer', () => ({
    useTransactionDetailsDrawer: () => ({
        selectedTxId: null,
        isTransactionSelected: () => false,
        openTransactionDetails: jest.fn(),
        closeTransactionDetails: jest.fn(),
    }),
}))

let mockUserId: string | null = 'viewer-1'
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: mockUserId ? { user: { userId: mockUserId }, invitedBy: null } : null }),
}))

// What GET /history/:id answers. The hook answers only when it is enabled,
// as the real query does.
let mockEntry: HistoryEntry | undefined
const mockUseHistoryEntry = jest.fn()
jest.mock('@/hooks/useHistoryEntry', () => ({
    useHistoryEntry: (...args: unknown[]) => mockUseHistoryEntry(...args),
}))

jest.mock('@/hooks/useTokenChainIcons', () => ({
    useTokenChainIcons: () => ({
        tokenIconUrl: undefined,
        chainIconUrl: undefined,
        resolvedChainName: 'Tron',
        resolvedTokenSymbol: 'USDT',
    }),
}))

jest.mock('@/hooks/usePointsConfetti', () => ({ usePointsConfetti: () => undefined }))
jest.mock('@/hooks/useAppReviewNudge', () => ({ useAppReviewNudge: () => undefined }))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => false }))
jest.mock('@/utils/demo-transactions', () => ({ recordDemoTransaction: jest.fn() }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

jest.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}))

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))

jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
}))

// Presentational children pull in icons/haptics/media that jsdom can't render;
// the receipt is built in the parent, so stub them to focus the test.
jest.mock('@/components/Global/SoundPlayer', () => ({ SoundPlayer: () => null }))
jest.mock('@/components/Global/PeanutMascot', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/0_Bruddle/PageStack', () => ({
    PageStack: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
        Center: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    }),
}))
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
}))
jest.mock('@/components/0_Bruddle/IconBubble', () => ({ IconBubble: () => null }))
jest.mock('@/components/Global/Card', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/AddressLink', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/CreateAccountButton', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Common/PointsCard', () => ({ __esModule: true, default: () => null }))

const INTENT_UUID = '1f3c5c92-2222-3333-4444-555555555555'
const SOURCE_HASH = '0x' + 'a'.repeat(64)

// a charge settling in the Peanut wallet's own token and chain, unless overridden
const charge = (transactionType: TChargeTransactionType, overrides: Record<string, unknown> = {}) =>
    ({
        uuid: INTENT_UUID,
        createdAt: '2026-10-22T10:00:00.000Z',
        tokenSymbol: 'USDC',
        tokenAmount: '64.5',
        chainId: PEANUT_WALLET_CHAIN.id.toString(),
        tokenAddress: PEANUT_WALLET_TOKEN,
        transactionType,
        ...overrides,
        requestLink: {
            recipientAddress: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE',
            reference: 'rent for october',
            attachmentUrl: 'https://example.com/invoice.pdf',
        },
    }) as unknown as TRequestChargeResponse

const paymentDetails = {
    uuid: INTENT_UUID,
    payerTransactionHash: SOURCE_HASH,
    createdAt: '2026-10-22T10:00:00.000Z',
} as unknown as PaymentCreationResponse

const historyEntry = (kind: string, status: string, extraData: Record<string, unknown>): HistoryEntry =>
    ({
        uuid: INTENT_UUID,
        type: 'TRANSACTION_INTENT',
        timestamp: '2026-10-22T10:00:00.000Z',
        createdAt: '2026-10-22T10:00:00.000Z',
        completedAt: status === 'COMPLETED' ? '2026-10-22T10:00:25.000Z' : undefined,
        amount: '64.5',
        chainId: '42161',
        tokenSymbol: 'USDC',
        txHash: SOURCE_HASH,
        status,
        userRole: 'SENDER',
        recipientAccount: { identifier: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE', type: 'WALLET_EXTERNAL', isUser: false },
        extraData: { kind, usdAmount: '64.5', ...extraData },
    }) as unknown as HistoryEntry

const renderWithdraw = () =>
    render(
        <PaymentSuccessView
            type="SEND"
            recipientType="ADDRESS"
            isWithdrawFlow
            amount="64.5"
            usdAmount="64.5"
            chargeDetails={charge('WITHDRAW')}
            paymentDetails={paymentDetails}
        />
    )

beforeEach(() => {
    capturedTransactions.length = 0
    mockUserId = 'viewer-1'
    mockEntry = undefined
    mockUseHistoryEntry.mockReset()
    mockUseHistoryEntry.mockImplementation((_id: unknown, _kind: unknown, options?: { enabled?: boolean }) => ({
        data: options?.enabled ? mockEntry : undefined,
    }))
})

describe('PaymentSuccessView — the settled network fee on the receipt', () => {
    it('reads the charge entry by its uuid and kind, without retrying a 404', () => {
        renderWithdraw()
        expect(mockUseHistoryEntry).toHaveBeenCalledWith(INTENT_UUID, 'CRYPTO_WITHDRAW', {
            enabled: true,
            retry: false,
        })
    })

    it('reads Pending before the entry loads, never a $0 placeholder', () => {
        renderWithdraw()
        expect(lastReceipt().networkFeeDetails).toEqual({ state: 'pending' })
    })

    it('reads Pending while the backend says the fee is pending', () => {
        mockEntry = historyEntry('CRYPTO_WITHDRAW', 'COMPLETED', { networkFeeStatus: 'pending', networkFeeUsd: null })
        renderWithdraw()
        expect(lastReceipt().networkFeeDetails).toEqual({ state: 'pending' })
        expect(lastReceipt().recipientReceivesUsd).toBeUndefined()
    })

    it("reads the flow's quote as the estimate before the entry loads, then the entry's", () => {
        render(
            <PaymentSuccessView
                type="SEND"
                recipientType="ADDRESS"
                isWithdrawFlow
                quotedNetworkFeeUsd={1.43}
                amount="64.5"
                usdAmount="64.5"
                chargeDetails={charge('WITHDRAW')}
                paymentDetails={paymentDetails}
            />
        )
        expect(lastReceipt().networkFeeDetails).toEqual({ state: 'pending', amountDisplay: '$1.43' })

        capturedTransactions.length = 0
        mockEntry = historyEntry('CRYPTO_WITHDRAW', 'COMPLETED', {
            networkFeeStatus: 'pending',
            networkFeeUsd: null,
            quotedFeeUsd: 1.47,
        })
        render(
            <PaymentSuccessView
                type="SEND"
                recipientType="ADDRESS"
                isWithdrawFlow
                quotedNetworkFeeUsd={1.43}
                amount="64.5"
                usdAmount="64.5"
                chargeDetails={charge('WITHDRAW')}
                paymentDetails={paymentDetails}
            />
        )
        expect(lastReceipt().networkFeeDetails).toEqual({ state: 'pending', amountDisplay: '$1.47' })
    })

    it('states the settled fee and what the recipient received', () => {
        mockEntry = historyEntry('CRYPTO_WITHDRAW', 'COMPLETED', {
            networkFeeStatus: 'settled',
            networkFeeUsd: 1.432671,
            deliveredUsd: '63.067329',
        })
        renderWithdraw()
        const receipt = lastReceipt()
        expect(receipt.networkFeeDetails).toEqual({ state: 'charged', amountDisplay: '$1.43' })
        expect(receipt.recipientReceivesUsd).toBe(63.067329)
        // the gross that left the wallet, as the backend states it
        expect(receipt.amount).toBe(64.5)
        expect(receipt.status).toBe('completed')
    })

    it('reads sponsored for a settled zero fee', () => {
        mockEntry = historyEntry('CRYPTO_WITHDRAW', 'COMPLETED', { networkFeeStatus: 'settled', networkFeeUsd: 0 })
        renderWithdraw()
        expect(lastReceipt().networkFeeDetails).toEqual({ state: 'sponsored' })
    })

    it('states no fee when the backend booked none it can stand behind', () => {
        mockEntry = historyEntry('CRYPTO_WITHDRAW', 'COMPLETED', { networkFeeStatus: 'unknown', networkFeeUsd: null })
        renderWithdraw()
        expect(lastReceipt().networkFeeDetails).toBeUndefined()
    })

    it("keeps the flow's comment, attachment, id and view over the entry", () => {
        mockEntry = historyEntry('CRYPTO_WITHDRAW', 'COMPLETED', {
            networkFeeStatus: 'settled',
            networkFeeUsd: 1.432671,
            deliveredUsd: '63.067329',
        })
        renderWithdraw()
        const receipt = lastReceipt()
        expect(receipt.memo).toBe('rent for october')
        expect(receipt.attachmentUrl).toBe('https://example.com/invoice.pdf')
        expect(receipt.id).toBe(INTENT_UUID)
        expect(receipt.sourceView).toBe('status')
        expect(receipt.extraDataForDrawer?.kind).toBe('CRYPTO_WITHDRAW')
    })

    it('a wallet payment reads sponsored, before and after its entry loads', () => {
        const renderSend = () =>
            render(
                <PaymentSuccessView
                    type="SEND"
                    recipientType="USERNAME"
                    user={{ username: 'alice', fullName: 'Alice' }}
                    amount="5"
                    usdAmount="5"
                    chargeDetails={charge('DIRECT_SEND')}
                    paymentDetails={paymentDetails}
                />
            )
        renderSend()
        expect(lastReceipt().networkFeeDetails).toEqual({ state: 'sponsored' })

        capturedTransactions.length = 0
        mockEntry = historyEntry('DIRECT_TRANSFER', 'COMPLETED', {})
        renderSend()
        expect(lastReceipt().networkFeeDetails).toEqual({ state: 'sponsored' })
        expect(lastReceipt().memo).toBe('rent for october')
    })

    it('an external-wallet payment claims no network fee, before and after its entry loads', () => {
        const renderExternal = () =>
            render(
                <PaymentSuccessView
                    type="SEND"
                    recipientType="USERNAME"
                    user={{ username: 'alice', fullName: 'Alice' }}
                    amount="5"
                    usdAmount="5"
                    chargeDetails={charge('REQUEST')}
                    isExternalWalletPayment
                />
            )
        renderExternal()
        expect(lastReceipt().networkFeeDetails).toBeUndefined()

        capturedTransactions.length = 0
        mockEntry = historyEntry('P2P_REQUEST_FULFILL', 'COMPLETED', {})
        renderExternal()
        expect(lastReceipt().networkFeeDetails).toBeUndefined()
    })

    it('a request paid onto another chain claims no network fee: Rhino takes one the API does not project', () => {
        mockEntry = historyEntry('P2P_REQUEST_FULFILL', 'COMPLETED', {})
        render(
            <PaymentSuccessView
                type="SEND"
                recipientType="USERNAME"
                user={{ username: 'alice', fullName: 'Alice' }}
                amount="5"
                usdAmount="5"
                chargeDetails={charge('REQUEST', { chainId: '1' })}
                paymentDetails={paymentDetails}
            />
        )
        expect(lastReceipt().networkFeeDetails).toBeUndefined()
    })

    it("a guest keeps the flow's receipt: the API does not serve them the entry", () => {
        mockUserId = null
        mockEntry = historyEntry('CRYPTO_WITHDRAW', 'COMPLETED', {
            networkFeeStatus: 'settled',
            networkFeeUsd: 1.432671,
            deliveredUsd: '63.067329',
        })
        renderWithdraw()
        expect(mockUseHistoryEntry).toHaveBeenCalledWith(
            INTENT_UUID,
            'CRYPTO_WITHDRAW',
            expect.objectContaining({ enabled: false })
        )
        expect(lastReceipt().networkFeeDetails).toEqual({ state: 'pending' })
        expect(lastReceipt().recipientReceivesUsd).toBeUndefined()
    })

    it('a receipt handed in by the caller wins, and the entry is not read', () => {
        mockEntry = historyEntry('CRYPTO_WITHDRAW', 'COMPLETED', { networkFeeStatus: 'settled', networkFeeUsd: 0 })
        const handedIn = { id: 'deposit-1', amount: 10 } as unknown as TransactionDetails
        render(
            <PaymentSuccessView
                type="DEPOSIT"
                usdAmount="10"
                chargeDetails={charge('WITHDRAW')}
                transactionDetails={handedIn}
            />
        )
        expect(lastReceipt()).toBe(handedIn)
        expect(mockUseHistoryEntry).toHaveBeenCalledWith(
            INTENT_UUID,
            'CRYPTO_WITHDRAW',
            expect.objectContaining({ enabled: false })
        )
    })
})
