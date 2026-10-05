/**
 * A manteca qr payment leaves Peanut's own account at Manteca, so its receipt
 * sheet must say so and must not claim a direct contract with Manteca. A
 * manteca on-ramp is the user's own account and keeps the relationship line.
 */
import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { ToastProvider } from '@/components/0_Bruddle/Toast'
import { IntlWrapper } from '@/test-utils/intl'
import { TransactionDetailsReceipt } from '../TransactionDetailsReceipt'
import type { TransactionDetails } from '../transactionTransformer'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/hooks/usePrimaryNameServer', () => ({ usePrimaryNameServer: () => ({ primaryName: undefined }) }))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ invitedUsernamesSet: new Set(), user: null }),
    useOptionalAuth: () => null,
}))
jest.mock('../ReceiptActions', () => ({ ReceiptActions: () => null }))
jest.mock('../ReceiptDetailsCard', () => ({ ReceiptDetailsCard: () => null }))
jest.mock('../provider-rows/LocalRailNudge', () => ({ LocalRailNudge: () => null }))

beforeAll(() => {
    window.matchMedia ??= (query: string) =>
        ({
            matches: false,
            media: query,
            addEventListener: () => {},
            removeEventListener: () => {},
            addListener: () => {},
            removeListener: () => {},
            dispatchEvent: () => false,
            onchange: null,
        }) as MediaQueryList
})

const mantecaEntry = (kind: string, direction: TransactionDetails['direction']): TransactionDetails => ({
    id: `manteca-${kind}`,
    direction,
    userName: 'Manteca',
    amount: 10,
    initials: 'M',
    fullName: '',
    totalAmountCollected: 0,
    status: 'completed',
    date: '2026-09-14T00:00:00Z',
    currency: { amount: '10000', code: 'ARS' },
    extraDataForDrawer: { provider: 'MANTECA', kind } as TransactionDetails['extraDataForDrawer'],
})

const openSheet = (transaction: TransactionDetails) => {
    render(
        <ToastProvider>
            <TransactionDetailsReceipt transaction={transaction} isPublic={false} />
        </ToastProvider>,
        { wrapper: IntlWrapper }
    )
    fireEvent.click(screen.getByRole('button', { name: 'About Manteca' }))
    return screen.getByRole('dialog')
}

const relationship = /You have a direct relationship/

describe('receipt provider note for manteca', () => {
    it('a qr payment shows the pooled account and no relationship line', () => {
        const sheet = openSheet(mantecaEntry('QR_PAY', 'qr_payment'))
        expect(within(sheet).getByText("Peanut's account at Manteca")).toBeInTheDocument()
        expect(within(sheet).queryByText(relationship)).not.toBeInTheDocument()
    })

    it('an on-ramp keeps the relationship line and no pooled account', () => {
        const sheet = openSheet(mantecaEntry('ONRAMP', 'bank_deposit'))
        expect(within(sheet).queryByText("Peanut's account at Manteca")).not.toBeInTheDocument()
        expect(within(sheet).getByText(relationship)).toBeInTheDocument()
    })
})
