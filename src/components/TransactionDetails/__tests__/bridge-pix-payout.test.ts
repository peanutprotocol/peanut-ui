import { mapTransactionDataForDrawer } from '../transactionTransformer'
import { EHistoryStatus, EHistoryUserRole, type HistoryEntry } from '@/utils/history.utils'

jest.mock('@/assets', () => ({}))
jest.mock('@/assets/payment-apps', () => ({ MERCADO_PAGO: '', PIX: '' }))
jest.mock('@/utils/pipelineAlerts', () => ({ pipelineAlert: jest.fn() }))

// A Pix payout through Bridge, as peanut-api-ts src/db/history.ts writes it (TASK-24910): Bridge's
// transfer state, `pixPayee` own or other, and for another person their name, to the owner only.
const payout = (pixPayee: 'own' | 'other', overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
    uuid: 'tr_1',
    type: 'TRANSACTION_INTENT',
    timestamp: new Date('2026-11-14T10:00:00Z'),
    amount: '18.87',
    currency: { amount: '100.00', code: 'brl' },
    chainId: 'arbitrum',
    tokenSymbol: 'USDC',
    tokenAddress: '',
    status: 'PAYMENT_PROCESSED' as EHistoryStatus,
    userRole: EHistoryUserRole.SENDER,
    senderAccount: { identifier: '0xaaaa', type: 'peanut-wallet', isUser: true, username: 'ana' },
    recipientAccount:
        pixPayee === 'other'
            ? { identifier: '11144477735', type: 'BANK_PIX', isUser: false, fullName: 'BRUNO LIMA' }
            : { identifier: 'ana@example.com', type: 'BANK_PIX', isUser: false },
    extraData: {
        kind: 'OFFRAMP',
        provider: 'BRIDGE',
        bridgeFlow: 'OFFRAMP',
        fulfillmentType: 'bridge',
        payoutRail: 'pix',
        pixPayee,
        usdAmount: '18.87',
    },
    ...overrides,
})
const details = (entry: HistoryEntry) => mapTransactionDataForDrawer(entry)

describe('a Bridge Pix payout in Activity', () => {
    it("reads a payout to another person's key as a send to them, by the name Bridge validated, the key beside it", () => {
        const { transactionDetails, transactionCardType } = details(payout('other'))
        expect(transactionCardType).toBe('send')
        expect(transactionDetails.direction).toBe('send')
        expect(transactionDetails.userName).toBe('Bruno Lima')
        expect(transactionDetails.nameDetail).toBe('111.444.777-35')
        expect(transactionDetails.status).toBe('completed')
    })

    it('reads a payout to the own key as a withdrawal to the bank account', () => {
        const { transactionDetails, transactionCardType } = details(payout('own'))
        expect(transactionCardType).toBe('bank_withdraw')
        expect(transactionDetails.direction).toBe('bank_withdraw')
        expect(transactionDetails.nameKey).toBe('name.bankAccount')
    })

    it('names the masked key alone on a shared receipt, which carries no name', () => {
        const { transactionDetails } = details(
            payout('other', {
                recipientAccount: { identifier: '***.444.777-**', type: 'BANK_PIX', isUser: false },
            })
        )
        expect(transactionDetails.direction).toBe('send')
        expect(transactionDetails.userName).toBe('***.444.777-**')
        expect(transactionDetails.nameDetail).toBeUndefined()
    })

    // API-CONTRACT 8.3: the receipt reads them through receiptProviderFee
    it('carries the market rate and the provider fee to the receipt', () => {
        const entry = payout('own', {
            currency: { amount: '113.77', code: 'brl' },
            extraData: {
                ...payout('own').extraData,
                marketRate: '5.72',
                providerFee: { amount: '0.63', currency: 'BRL' },
            },
        })
        expect(details(entry).transactionDetails.extraDataForDrawer).toMatchObject({
            marketRate: '5.72',
            providerFee: { amount: '0.63', currency: 'BRL' },
        })
    })

    it('reads as processing while Bridge pays, and as failed once returned', () => {
        expect(
            details(payout('other', { status: 'PAYMENT_SUBMITTED' as EHistoryStatus })).transactionDetails.status
        ).toBe('processing')
        expect(details(payout('other', { status: 'RETURNED' as EHistoryStatus })).transactionDetails.status).toBe(
            'failed'
        )
    })
})
