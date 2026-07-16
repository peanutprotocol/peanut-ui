/**
 * BridgeDepositInstructions — the deposit-instructions block in the
 * transaction drawer.
 *
 * The reference here must be the SAME shortened 10-char form the Add Money
 * screen shows (some banks cap reference fields at 10 chars; Bridge matches
 * deposits on the partial reference). Showing the full form only here made a
 * user believe they wired with the wrong code — the two-different-codes
 * confusion. Nested primitives are stubbed.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('@/components/Payment/PaymentInfoRow', () => ({
    PaymentInfoRow: ({ label, value }: { label: React.ReactNode; value: React.ReactNode }) => (
        <div>
            {label}
            {value}
        </div>
    ),
}))
jest.mock('@/components/Global/CopyToClipboard', () => ({
    __esModule: true,
    default: ({ textToCopy }: { textToCopy: string }) => <div data-testid="copy" data-text={textToCopy} />,
}))
jest.mock('@/components/Global/MoreInfo', () => ({ __esModule: true, default: () => <span /> }))
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => <span /> }))

// import must come after jest.mock
import { BridgeDepositInstructions } from '../BridgeDepositInstructions'

const FULL_REFERENCE = 'BRGTESTREF1234567890'
const SHORT_REFERENCE = FULL_REFERENCE.slice(0, 10)

const transaction = {
    extraDataForDrawer: {
        depositInstructions: {
            deposit_message: FULL_REFERENCE,
            bank_name: 'Deutsche Bank',
            bank_address: 'Frankfurt, Germany',
            account_holder_name: 'Peanut Protocol',
            iban: 'DE89370400440532013000',
            bic: 'COBADEFFXXX',
        },
    },
} as unknown as import('@/components/TransactionDetails/transactionTransformer').TransactionDetails

describe('BridgeDepositInstructions deposit message', () => {
    it('shows and copies the same shortened 10-char reference as the Add Money screen', () => {
        render(<BridgeDepositInstructions transaction={transaction} />)

        expect(screen.getByText(SHORT_REFERENCE)).toBeInTheDocument()
        expect(screen.queryByText(FULL_REFERENCE)).not.toBeInTheDocument()

        const copyTexts = screen.getAllByTestId('copy').map((el) => el.getAttribute('data-text'))
        expect(copyTexts).toContain(SHORT_REFERENCE)
        expect(copyTexts).not.toContain(FULL_REFERENCE)
    })
})
