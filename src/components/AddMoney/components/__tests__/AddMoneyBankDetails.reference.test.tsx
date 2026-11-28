import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { shortDepositReference } from '@/utils/format.utils'
import messages from '@/i18n/app/messages/en.json'
import AddMoneyBankDetails from '../AddMoneyBankDetails'

/**
 * TASK-25079: one-off EUR top-ups sent without the reference became Bridge
 * "Unmatched Deposits" (three on 2026-11-17). The reference is shown in its
 * own card with a copy control, and the line under it says it is required
 * and what happens without it.
 */
const mockInstructions = { amount: '21', depositMessage: 'BRGABCDEF123' }

jest.mock('next/navigation', () => ({
    useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
    useParams: () => ({ country: 'germany' }),
}))
jest.mock('nuqs', () => ({
    useQueryState: (key: string) => [key === 'amount' ? '21' : null],
    parseAsString: {},
}))
jest.mock('@/context/OnrampFlowContext', () => ({
    useOnrampFlow: () => ({ onrampData: { transferId: 't-1', depositInstructions: mockInstructions } }),
}))
jest.mock('@/hooks/useOnrampQuote', () => ({ useOnrampQuote: () => ({ netRate: 1.1, isLoading: false }) }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/CopyToClipboard', () => ({
    __esModule: true,
    default: ({ textToCopy }: { textToCopy: string }) => <button data-copy={textToCopy}>copy</button>,
}))
jest.mock('@/components/Payment/PaymentInfoRow', () => ({ PaymentInfoRow: () => null }))
jest.mock('@/components/Global/ShareButton', () => ({ __esModule: true, default: () => null }))

it('shows the reference with a copy control and says it is required', () => {
    renderWithIntl(<AddMoneyBankDetails onBack={jest.fn()} />)
    const reference = shortDepositReference(mockInstructions.depositMessage)

    expect(screen.getByText(messages.addMoney.bankDetails.depositReference)).toBeInTheDocument()
    expect(screen.getByText(reference)).toBeInTheDocument()
    expect(document.querySelector(`[data-copy="${reference}"]`)).not.toBeNull()

    const note = messages.addMoney.bankDetails.pasteInReferenceField
    expect(screen.getByText(note)).toBeInTheDocument()
    expect(note).toMatch(/^Required/)
    expect(note).toMatch(/Without it/)
})
