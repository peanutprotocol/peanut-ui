/**
 * Regression: the P2P (DIRECT_TRANSFER) success screen must build its receipt
 * transaction with the resolvable intent uuid, NOT the on-chain tx hash.
 *
 * The receipt page and its PDF twin resolve a DIRECT_TRANSFER through the
 * backend GET /history/:id, which only accepts `transaction_intents.id` (the
 * charge uuid). A tx hash is not a resolvable key, so sharing/downloading the
 * receipt PDF 404s ("receipt PDF unavailable"). The share/download affordances
 * feed `transaction.id` straight into /receipt/[entryId]/pdf, so `id` has to be
 * the uuid. The on-chain hash still travels separately in `txHash`.
 */

import { render } from '@testing-library/react'
import type { TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import PaymentSuccessView from '@/features/payments/shared/components/PaymentSuccessView'

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const chargeDetails: any = {
    uuid: INTENT_UUID,
    createdAt: '2026-09-18T00:00:00.000Z',
    tokenSymbol: 'USDC',
    tokenAmount: '5',
    chainId: '42161',
    tokenAddress: '0xtoken',
    requestLink: { recipientAddress: '0xrecipient', reference: undefined, attachmentUrl: undefined },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const paymentDetails: any = {
    uuid: INTENT_UUID,
    payerTransactionHash: TX_HASH,
    createdAt: '2026-09-18T00:00:00.000Z',
}

beforeEach(() => {
    capturedTransactions.length = 0
})

describe('PaymentSuccessView — P2P receipt id', () => {
    it('feeds the resolvable intent uuid (not the tx hash) as the receipt id', () => {
        render(
            <PaymentSuccessView
                type="SEND"
                recipientType="USERNAME"
                user={{ username: 'alice', fullName: 'Alice' }}
                usdAmount="5"
                chargeDetails={chargeDetails}
                paymentDetails={paymentDetails}
            />
        )

        const receipt = capturedTransactions.find((tx) => tx != null)
        expect(receipt).toBeTruthy()
        // The id must be the intent uuid so /receipt/[id]/pdf resolves the entry
        // via GET /history/:id — a tx hash would 404.
        expect(receipt!.id).toBe(INTENT_UUID)
        expect(receipt!.id).not.toBe(TX_HASH)
        // The on-chain hash is still carried, just in its own field.
        expect(receipt!.txHash).toBe(TX_HASH)
        expect(receipt!.extraDataForDrawer?.kind).toBe('DIRECT_TRANSFER')
    })
})
