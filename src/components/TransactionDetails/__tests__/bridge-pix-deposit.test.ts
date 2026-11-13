import { mapTransactionDataForDrawer } from '../transactionTransformer'
import { isReturnedDeposit, receiptConversionLine, receiptExchangeRate } from '../receipt-conversion.utils'
import { EHistoryStatus, EHistoryUserRole, getTransactionSign, type HistoryEntry } from '@/utils/history.utils'

jest.mock('@/assets', () => ({}))
jest.mock('@/assets/payment-apps', () => ({ MERCADO_PAGO: '', PIX: '' }))
jest.mock('@/utils/pipelineAlerts', () => ({ pipelineAlert: jest.fn() }))

// A Pix into the user's BRL account on Bridge, as peanut-api-ts src/db/history.ts writes it on the
// API branch of TASK-24910 (API-CONTRACT.md section 5): the payer's bank is the sender, typed by
// Bridge's payment rail (`pix`); the rate is reais per dollar; the Pix end-to-end id is the payment
// reference and the payer's note alone is the sender reference. Figures: the first deposit, 13 Nov.
const E2E = 'E00416968202611131908aBcD1234567'
const pixDeposit = (overrides: Partial<HistoryEntry> = {}, extraData: Record<string, unknown> = {}): HistoryEntry => ({
    uuid: 'fixture-bridge-pix-deposit',
    type: 'TRANSACTION_INTENT',
    timestamp: new Date('2026-11-13T19:08:00Z'),
    amount: '1.76',
    currency: { amount: '10.00', code: 'BRL' },
    chainId: 'arbitrum',
    tokenSymbol: 'USDC',
    tokenAddress: '',
    status: 'PAYMENT_PROCESSED' as EHistoryStatus,
    userRole: EHistoryUserRole.RECIPIENT,
    senderAccount: { identifier: '', type: 'pix', isUser: false, fullName: 'ANA SOUZA' },
    recipientAccount: { identifier: '0xaaaa', type: 'peanut-wallet', isUser: true, username: 'ana' },
    extraData: {
        kind: 'ONRAMP',
        provider: 'BRIDGE',
        bridgeFlow: 'ONRAMP',
        fulfillmentType: 'bridge',
        // stamped by completeHistoryEntry before the row is mapped
        usdAmount: '1.76',
        receipt: { initial_amount: '10.00', final_amount: '1.76', exchange_rate: '5.681818181818182' },
        paymentReference: E2E,
        senderReference: 'aluguel',
        ...extraData,
    },
    ...overrides,
})
const details = (entry: HistoryEntry) => mapTransactionDataForDrawer(entry).transactionDetails

describe('a Bridge Pix deposit in Activity', () => {
    it('is a deposit into the bank details, from the payer, as every Bridge deposit account reads', () => {
        const tx = details(pixDeposit())
        expect(tx.direction).toBe('bank_deposit')
        expect(tx.nameKey).toBe('name.bankAccount')
        expect(tx.status).toBe('completed')
        expect(tx.extraDataForDrawer?.isDepositAccountDeposit).toBe(true)
        expect(tx.extraDataForDrawer?.payerName).toBe('ANA SOUZA')
    })

    it("keeps the end-to-end id as the payment's reference and the payer's note as the note", () => {
        const drawer = details(pixDeposit()).extraDataForDrawer
        expect(drawer?.paymentReference).toBe(E2E)
        expect(drawer?.senderReference).toBe('aluguel')
    })

    it('states the conversion and the rate in reais per dollar', () => {
        const tx = details(pixDeposit())
        expect(receiptConversionLine(tx, getTransactionSign(tx))).toBe('BRL 10 → 1.76 USD')
        expect(receiptExchangeRate(tx)).toBe('1 USD = BRL 5.6818')
        expect(isReturnedDeposit(tx)).toBe(false)
    })

    it('reads a Pix from a third person that Bridge sent back as returned', () => {
        const tx = details(
            pixDeposit({ status: 'REFUNDED' as EHistoryStatus }, { returnReason: { code: 'third_party' } })
        )
        expect(tx.status).toBe('refunded')
        expect(tx.actionLabelKey).toBe('type.returnedToSender')
        expect(tx.extraDataForDrawer?.returnReasonCode).toBe('third_party')
        expect(isReturnedDeposit(tx)).toBe(true)
    })
})
