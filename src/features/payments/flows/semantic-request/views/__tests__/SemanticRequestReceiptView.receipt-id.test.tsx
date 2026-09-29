/**
 * The paid-charge receipt view must key its receipt by the charge uuid and the
 * charge's own kind — the pair GET /history/:id resolves. The view serves both
 * paid requests and direct sends (a send's receipt link is `?chargeId=`), so
 * neither the tx hash nor a fixed kind is a valid key.
 */

import { render } from '@testing-library/react'
import type { TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { SemanticRequestReceiptView } from '../SemanticRequestReceiptView'

const capturedTransactions: TransactionDetails[] = []
let mockCharge: unknown

jest.mock('@/components/TransactionDetails/TransactionDetailsReceipt', () => ({
    TransactionDetailsReceipt: ({ transaction }: { transaction: TransactionDetails }) => {
        capturedTransactions.push(transaction)
        return null
    },
}))
jest.mock('../../useSemanticRequestFlow', () => ({
    useSemanticRequestFlow: () => ({
        charge: mockCharge,
        recipient: { identifier: 'alice' },
        parsedUrl: null,
        isFetchingCharge: false,
    }),
}))
jest.mock('@/hooks/useTokenChainIcons', () => ({
    useTokenChainIcons: () => ({ resolvedChainName: 'Arbitrum', resolvedTokenSymbol: 'USDC' }),
}))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/0_Bruddle/PageStack', () => ({
    PageStack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const CHARGE_UUID = '11111111-2222-3333-4444-555555555555'
const TX_HASH = '0xdeadbeef'

const paidCharge = (transactionType: string) => {
    const payment = { status: 'SUCCESSFUL', payerTransactionHash: TX_HASH, createdAt: '2026-09-18T00:00:00.000Z' }
    return {
        uuid: CHARGE_UUID,
        createdAt: '2026-09-18T00:00:00.000Z',
        tokenSymbol: 'USDC',
        tokenAmount: '5',
        transactionType,
        fulfillmentPayment: payment,
        payments: [payment],
        requestLink: { reference: null, attachmentUrl: null },
    }
}

beforeEach(() => {
    capturedTransactions.length = 0
})

describe('SemanticRequestReceiptView — receipt id and kind', () => {
    it.each([
        ['REQUEST', 'P2P_REQUEST_FULFILL'],
        ['DIRECT_SEND', 'DIRECT_TRANSFER'],
    ])('a paid %s charge resolves as %s by the charge uuid', (transactionType, expectedKind) => {
        mockCharge = paidCharge(transactionType)
        render(<SemanticRequestReceiptView />)

        const receipt = capturedTransactions[0]
        expect(receipt.id).toBe(CHARGE_UUID)
        expect(receipt.extraDataForDrawer?.kind).toBe(expectedKind)
        expect(receipt.txHash).toBe(TX_HASH)
    })
})
