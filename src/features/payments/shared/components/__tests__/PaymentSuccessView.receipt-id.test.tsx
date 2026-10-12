/**
 * Regression: every success-screen variant must build its receipt transaction
 * with the id AND kind that GET /history/:id resolves — the same pair history
 * uses for that transaction.
 *
 * The receipt page and its PDF twin look an entry up by `transaction_intents.id`
 * (the charge uuid) and the intent kind. A tx hash is not a resolvable key, and
 * the right uuid under the wrong kind also 404s ("receipt PDF unavailable").
 * The share/download affordances feed `transaction.id` and
 * `extraDataForDrawer.kind` straight into /receipt/[entryId]/pdf. The on-chain
 * hash still travels separately in `txHash`.
 */

import { render } from '@testing-library/react'
import type { TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import PaymentSuccessView from '@/features/payments/shared/components/PaymentSuccessView'
import type { PaymentCreationResponse, TChargeTransactionType, TRequestChargeResponse } from '@/services/services.types'

const capturedTransactions: Array<TransactionDetails | null | undefined> = []

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

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'viewer-1' }, invitedBy: null } }),
}))

jest.mock('@/hooks/useTokenChainIcons', () => ({
    useTokenChainIcons: () => ({
        tokenIconUrl: undefined,
        chainIconUrl: undefined,
        resolvedChainName: 'Arbitrum',
        resolvedTokenSymbol: 'USDC',
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
// the receipt id is built in the parent, so stub them to focus the test.
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

const INTENT_UUID = '11111111-2222-3333-4444-555555555555'
const TX_HASH = '0xdeadbeef' // a tx hash — not a resolvable receipt id

const chargeOfType = (transactionType: TChargeTransactionType) =>
    ({
        uuid: INTENT_UUID,
        createdAt: '2026-09-18T00:00:00.000Z',
        tokenSymbol: 'USDC',
        tokenAmount: '5',
        chainId: '42161',
        tokenAddress: '0xtoken',
        transactionType,
        requestLink: { recipientAddress: '0xrecipient', reference: undefined, attachmentUrl: undefined },
    }) as unknown as TRequestChargeResponse

const paymentDetails = {
    uuid: INTENT_UUID,
    payerTransactionHash: TX_HASH,
    createdAt: '2026-09-18T00:00:00.000Z',
} as unknown as PaymentCreationResponse

beforeEach(() => {
    capturedTransactions.length = 0
})

// each case carries the props its flow's wrapper passes to PaymentSuccessView
const CASES = [
    {
        flow: 'direct send',
        chargeType: 'DIRECT_SEND',
        expectedKind: 'DIRECT_TRANSFER',
        props: { recipientType: 'USERNAME', user: { username: 'alice', fullName: 'Alice' } },
    },
    {
        flow: 'request fulfilment',
        chargeType: 'REQUEST',
        expectedKind: 'P2P_REQUEST_FULFILL',
        props: { recipientType: 'ADDRESS' },
    },
    {
        flow: 'pot contribution',
        chargeType: 'REQUEST',
        expectedKind: 'P2P_REQUEST_FULFILL',
        props: { recipientType: 'USERNAME', user: { username: 'bob', fullName: 'Bob' } },
    },
    {
        flow: 'crypto withdraw',
        chargeType: 'WITHDRAW',
        expectedKind: 'CRYPTO_WITHDRAW',
        props: { recipientType: 'ADDRESS', isWithdrawFlow: true },
    },
] as const

describe('PaymentSuccessView — receipt id and kind per transaction type', () => {
    it.each(CASES)('$flow resolves as $expectedKind by the charge uuid', ({ chargeType, expectedKind, props }) => {
        render(
            <PaymentSuccessView
                type="SEND"
                usdAmount="5"
                chargeDetails={chargeOfType(chargeType)}
                paymentDetails={paymentDetails}
                {...props}
            />
        )

        const receipt = capturedTransactions.find((tx) => tx != null)
        expect(receipt).toBeTruthy()
        expect(receipt!.id).toBe(INTENT_UUID)
        expect(receipt!.extraDataForDrawer?.kind).toBe(expectedKind)
        // The on-chain hash is still carried, just in its own field.
        expect(receipt!.txHash).toBe(TX_HASH)
    })
})
