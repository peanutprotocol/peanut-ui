/**
 * The receipt used to end on a "Receipt from Peanut · peanut.me" line. It is
 * gone (ruled 2026-09-21, hugo): inside the app drawer the user already knows
 * where they are, the line was hand-rolled rather than a design-system
 * component, and it named a domain without being clickable.
 *
 * Attribution still exists where it is actually needed, and both places own
 * their own copy: the shared/public receipt heads with PublicReceiptIssuer
 * (logo + a clickable peanut.me), and the downloadable PDF heads with its own
 * wordmark and `officialReceipt.pdf.issuedBy`.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { ToastProvider } from '@/components/0_Bruddle/Toast'
import { IntlWrapper } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import es419 from '@/i18n/app/messages/es-419.json'
import ptBR from '@/i18n/app/messages/pt-BR.json'
import esAR from '@/i18n/app/messages/es-AR.json'
import { TransactionDetailsReceipt } from '../TransactionDetailsReceipt'
import type { TransactionDetails } from '../transactionTransformer'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/hooks/usePrimaryNameServer', () => ({ usePrimaryNameServer: () => ({ primaryName: undefined }) }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ invitedUsernamesSet: new Set(), user: null }) }))
jest.mock('../ReceiptActions', () => ({ ReceiptActions: () => null }))
jest.mock('../ReceiptDetailsCard', () => ({ ReceiptDetailsCard: () => null }))
jest.mock('../provider-rows/LocalRailNudge', () => ({ LocalRailNudge: () => null }))

const transaction: TransactionDetails = {
    id: 'completed-deposit',
    direction: 'bank_deposit',
    userName: 'Bank transfer',
    amount: 250,
    initials: 'BT',
    fullName: '',
    totalAmountCollected: 0,
    status: 'completed',
    date: '2026-09-14T00:00:00Z',
    currency: { amount: '250', code: 'USD' },
}

describe('receipt attribution line', () => {
    it('the in-app drawer renders no peanut.me attribution line', () => {
        render(
            <ToastProvider>
                <TransactionDetailsReceipt transaction={transaction} isPublic={false} />
            </ToastProvider>,
            { wrapper: IntlWrapper }
        )
        expect(screen.queryByText(/peanut\.me/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/Receipt from Peanut/i)).not.toBeInTheDocument()
    })

    it.each([
        ['en', en],
        ['es-419', es419],
        ['pt-BR', ptBR],
        ['es-AR', esAR],
    ])('%s carries no retired officialReceipt.footer key', (_locale, messages) => {
        const officialReceipt =
            (messages as { transaction?: { officialReceipt?: Record<string, unknown> } }).transaction
                ?.officialReceipt ?? {}
        expect('footer' in officialReceipt).toBe(false)
    })
})
