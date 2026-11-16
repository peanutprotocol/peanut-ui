/**
 * A Pix deposit Avenia received and gave back (paid from an account not under the user's CPF) stays
 * FAILED on the wire (TASK-24947, release 168 smoke). `extraData.pixReturned` says it was returned, to
 * every viewer; `returnReason` says why, to the owner only (Chip on ui#4116: the state is public, the
 * reason private). It reads as a returned deposit everywhere: "Returned" in place of "Failed"; the
 * owner reads the deposit screen's own sentence for `third_party`, anyone else the general line.
 * Nothing was converted, so the receipt keeps the estimate row. Without the flag the entry reads as
 * it did; a lapsed code (CANCELLED) too.
 *
 * Entries are shaped as `GET /users/history` sends them to the owner, and as the public receipt
 * projection sends them to anyone (no `pixDeposit`, no `returnReason`); made-up data only.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '@/components/0_Bruddle/Toast'
import { IntlWrapper } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import { TransactionDetailsReceipt } from '../TransactionDetailsReceipt'
import { ReceiptDetailsCard } from '../ReceiptDetailsCard'
import { useReceiptViewModel } from '../useReceiptViewModel'
import TransactionCard from '../TransactionCard'
import { mapTransactionDataForDrawer, type TransactionDetails } from '../transactionTransformer'
import { buildReceiptPdfModel, type PdfTranslate } from '@/app/receipt/[entryId]/pdf/receipt-pdf-model'
import type { HistoryEntry } from '@/utils/history.utils'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('use-haptic', () => ({ useHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/hooks/usePrimaryNameServer', () => ({ usePrimaryNameServer: () => ({ primaryName: undefined }) }))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ invitedUsernamesSet: new Set(), user: null }),
    useOptionalAuth: () => null,
}))
jest.mock('../ReceiptActions', () => ({ ReceiptActions: () => null }))
jest.mock('../provider-rows/LocalRailNudge', () => ({ LocalRailNudge: () => null }))
jest.mock('../TransactionDetailsDrawer', () => ({ TransactionDetailsDrawer: () => null }))
jest.mock('@/assets', () => ({}))
jest.mock('@/assets/payment-apps', () => ({ MERCADO_PAGO: '/mercado-pago.svg', PIX: '/pix.svg' }))
jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ src, alt }: { src: string; alt: string }) => React.createElement('img', { src, alt }),
}))

type Reason = 'third_party' | 'other'

// R$22 quoted at about 3.84 USDC: the API books the quoted USD as the amount and keeps the reais
const publicPart = (status: string, returned: boolean) => ({
    uuid: 'fixture-pix-deposit-returned',
    type: 'TRANSACTION_INTENT',
    timestamp: new Date('2026-11-16T12:00:00.000Z'),
    amount: '3.84',
    currency: { amount: '22.00', code: 'BRL' },
    tokenSymbol: 'USDC',
    chainId: '42161',
    status,
    userRole: 'RECIPIENT',
    extraData: {
        kind: 'ONRAMP',
        provider: 'AVENIA',
        paymentMethod: 'PIX',
        ...(returned ? { pixReturned: true } : {}),
    },
})
/** The owner's entry: the public part, the code state and the reason. */
const ownerDeposit = (status: string, { returned = true, reason }: { returned?: boolean; reason?: Reason } = {}) => {
    const part = publicPart(status, returned)
    return {
        ...part,
        senderAccount: { identifier: '', type: 'address', isUser: false },
        recipientAccount: {
            identifier: '0x1111111111111111111111111111111111111111',
            type: 'peanut-wallet',
            isUser: true,
        },
        extraData: {
            ...part.extraData,
            usdAmount: '3.84',
            pixDeposit: { codePayable: false, expiresAt: null },
            ...(reason ? { returnReason: { code: reason, text: null } } : {}),
        },
    } as unknown as HistoryEntry
}
/** What anyone with the link reads: no `pixDeposit`, no `returnReason`. */
const sharedDeposit = (status: string) => publicPart(status, true) as unknown as HistoryEntry

const details = (wire: HistoryEntry) => mapTransactionDataForDrawer(wire).transactionDetails

function Header({ transaction, isPublic = false }: { transaction: TransactionDetails; isPublic?: boolean }) {
    return (
        <QueryClientProvider client={new QueryClient()}>
            <ToastProvider>
                <TransactionDetailsReceipt transaction={transaction} isPublic={isPublic} />
            </ToastProvider>
        </QueryClientProvider>
    )
}
function Rows({ transaction }: { transaction: TransactionDetails }) {
    const vm = useReceiptViewModel(transaction, { isPublic: false, surface: 'page' })
    return <ReceiptDetailsCard transaction={transaction} vm={vm} shouldShowQrShare={false} />
}
const renderRow = (wire: HistoryEntry) => {
    const { transactionDetails, transactionCardType } = mapTransactionDataForDrawer(wire)
    return render(
        <TransactionCard
            type={transactionCardType}
            name={transactionDetails.userName}
            amount={Number(transactionDetails.amount)}
            status={transactionDetails.status}
            initials={transactionDetails.initials}
            transaction={transactionDetails}
            isSelected={false}
            onOpen={jest.fn()}
            onClose={jest.fn()}
        />,
        { wrapper: IntlWrapper }
    )
}
const t: PdfTranslate = (key) => key
const pdfStatus = (tx: TransactionDetails) =>
    buildReceiptPdfModel(tx, t, 'en').rows.find((row) => row.label === 'transaction.officialReceipt.pdf.status')?.value

describe('a Pix deposit the provider gave back, to its owner', () => {
    it('reads as Returned, not Failed, and keeps the estimate: nothing was converted', () => {
        const tx = details(ownerDeposit('FAILED', { reason: 'third_party' }))
        expect(tx.status).toBe('refunded')
        expect(tx.actionLabelKey).toBe('type.returnedToSender')
        expect(tx.extraDataForDrawer?.returnReasonCode).toBe('third_party')
        expect(tx.extraDataForDrawer?.returnedBeforeConversion).toBe(true)
        expect(tx.extraDataForDrawer?.wasReturned).toBeUndefined()
        expect(tx.amount).toBe(3.84)
    })

    it('third_party: the drawer says what the deposit screen said, under the Returned badge', () => {
        render(<Header transaction={details(ownerDeposit('FAILED', { reason: 'third_party' }))} />, {
            wrapper: IntlWrapper,
        })
        // the badge, and the date row of the details
        expect(screen.getAllByText(en.transaction.returnedStatus)).toHaveLength(2)
        expect(screen.queryByText(en.common.status.failed)).toBeNull()
        expect(screen.getByText(en.pix.deposit.returnedBody)).toBeInTheDocument()
        expect(screen.queryByText(en.transaction.returnedReasonThirdParty)).toBeNull()
        const amount = screen.getByText('$3.84', { exact: false })
        expect(amount.closest('h1')).toHaveClass('line-through')
    })

    it('other: the general line', () => {
        render(<Header transaction={details(ownerDeposit('FAILED', { reason: 'other' }))} />, { wrapper: IntlWrapper })
        expect(screen.getAllByText(en.transaction.returnedStatus).length).toBeGreaterThan(0)
        expect(screen.getByText(en.transaction.returnedReason)).toBeInTheDocument()
        expect(screen.queryByText(en.pix.deposit.returnedBody)).toBeNull()
    })

    it('the details keep "≈ BRL 22", date the return, and show no rate or fee', () => {
        render(<Rows transaction={details(ownerDeposit('FAILED', { reason: 'third_party' }))} />, {
            wrapper: IntlWrapper,
        })
        expect(screen.getByText(en.transaction.rows.estimateConversion)).toBeInTheDocument()
        expect(screen.getByText('≈ BRL 22')).toBeInTheDocument()
        expect(screen.queryByText(en.transaction.rows.converted)).toBeNull()
        expect(screen.queryByText(en.common.exchangeRate)).toBeNull()
        expect(screen.queryByText(en.pix.withdraw.fee)).toBeNull()
        expect(screen.getByText(en.transaction.returnedStatus)).toBeInTheDocument()
    })

    it('the Activity row reads "Returned to sender", the amount struck through', () => {
        renderRow(ownerDeposit('FAILED', { reason: 'third_party' }))
        expect(screen.getByText(en.transaction.type.returnedToSender)).toBeInTheDocument()
        expect(screen.getByText(/\$3\.84/)).toHaveClass('line-through')
    })

    it('the PDF prints Returned and the estimate', () => {
        const tx = details(ownerDeposit('FAILED', { reason: 'third_party' }))
        expect(pdfStatus(tx)).toBe('transaction.returnedStatus')
        expect(buildReceiptPdfModel(tx, t, 'en').convertedAmountDisplay).toBe('≈ BRL 22')
    })
})

// Chip on ui#4116: the shared receipt and the anonymous PDF said "Failed" while the owner saw "Returned"
describe('the same deposit, to anyone with the link', () => {
    it('reads as Returned from the public flag alone, with the general line, never the CPF sentence', () => {
        const tx = details(sharedDeposit('FAILED'))
        expect(tx.status).toBe('refunded')
        expect(tx.actionLabelKey).toBe('type.returnedToSender')
        expect(tx.extraDataForDrawer?.returnReasonCode).toBeUndefined()
        render(<Header transaction={tx} isPublic />, { wrapper: IntlWrapper })
        expect(screen.getAllByText(en.transaction.returnedStatus).length).toBeGreaterThan(0)
        expect(screen.queryByText(en.common.status.failed)).toBeNull()
        expect(screen.getByText(en.transaction.returnedReason)).toBeInTheDocument()
        expect(screen.queryByText(en.pix.deposit.returnedBody)).toBeNull()
    })

    it('a shared receipt keeps the general line even if a reason reached it', () => {
        render(<Header transaction={details(ownerDeposit('FAILED', { reason: 'third_party' }))} isPublic />, {
            wrapper: IntlWrapper,
        })
        expect(screen.getByText(en.transaction.returnedReason)).toBeInTheDocument()
        expect(screen.queryByText(en.pix.deposit.returnedBody)).toBeNull()
    })

    it('the Activity row and the anonymous PDF read Returned too', () => {
        renderRow(sharedDeposit('FAILED'))
        expect(screen.getByText(en.transaction.type.returnedToSender)).toBeInTheDocument()
        expect(pdfStatus(details(sharedDeposit('FAILED')))).toBe('transaction.returnedStatus')
    })
})

describe('a Pix deposit without the flag reads as it does today', () => {
    it('a reason without pixReturned: Failed, no reason, no guess from returnReason or the status', () => {
        const tx = details(ownerDeposit('FAILED', { returned: false, reason: 'third_party' }))
        expect(tx.status).toBe('failed')
        expect(tx.actionLabelKey).toBeUndefined()
        expect(tx.extraDataForDrawer?.returnedBeforeConversion).toBeUndefined()
        render(<Header transaction={tx} />, { wrapper: IntlWrapper })
        expect(screen.getByText(en.common.status.failed)).toBeInTheDocument()
        expect(screen.queryByText(en.transaction.returnedStatus)).toBeNull()
        expect(screen.queryByText(en.pix.deposit.returnedBody)).toBeNull()
        expect(pdfStatus(tx)).toBe('common.status.failed')
    })

    it('a lapsed code (CANCELLED): Cancelled, no reason', () => {
        const tx = details(ownerDeposit('CANCELLED', { returned: false }))
        expect(tx.status).toBe('cancelled')
        expect(tx.actionLabelKey).toBeUndefined()
        render(<Header transaction={tx} />, { wrapper: IntlWrapper })
        expect(screen.queryByText(en.transaction.returnedStatus)).toBeNull()
        expect(screen.queryByText(en.pix.deposit.returnedBody)).toBeNull()
    })
})
