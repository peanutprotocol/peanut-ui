import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import ConfirmWithdrawView from '../ConfirmWithdrawView'

jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/PeanutActionDetailsCard', () => ({
    __esModule: true,
    default: ({ amount }: { amount: string }) => <div data-testid="spend-amount">{amount}</div>,
}))
jest.mock('@/components/Global/AddressLink', () => ({
    __esModule: true,
    default: ({ address }: { address: string }) => <span>{address}</span>,
}))
jest.mock('@/components/Global/DisplayIcon', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({
        children,
        disabled,
        onClick,
    }: {
        children: React.ReactNode
        disabled?: boolean
        onClick: () => void
    }) => (
        <button disabled={disabled} onClick={onClick}>
            {children}
        </button>
    ),
}))
jest.mock('@/hooks/useTokenChainIcons', () => ({
    useTokenChainIcons: () => ({ resolvedChainName: 'Solana', resolvedTokenSymbol: 'USDC' }),
}))

const baseProps = {
    amount: '10',
    token: { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', symbol: 'USDC', decimals: 6, price: 1 } as never,
    chain: { chainId: 'solana', networkName: 'Solana' } as never,
    toAddress: '11111111111111111111111111111111',
    onConfirm: jest.fn(),
    onBack: jest.fn(),
    isCrossChain: true,
    receiveAmount: '10',
    payAmount: '10',
}

describe('ConfirmWithdrawView — network fee row', () => {
    it('shows the sponsored label when the account quote carries no fee, and pay == receive', () => {
        renderWithIntl(<ConfirmWithdrawView {...baseProps} networkFee={0} />)
        expect(screen.getByText('Sponsored by Peanut!')).toBeInTheDocument()
        // "Recipient receives" and "You pay" both read $10 — nothing on top.
        expect(screen.getAllByText('$10')).toHaveLength(2)
    })

    it('shows a dash, not the sponsored label, when the quote failed', () => {
        renderWithIntl(<ConfirmWithdrawView {...baseProps} networkFee={0} quoteFailed />)
        expect(screen.getByText('-')).toBeInTheDocument()
        expect(screen.queryByText('Sponsored by Peanut!')).not.toBeInTheDocument()
    })

    it('shows a quoted fee verbatim when Rhino quotes one', () => {
        renderWithIntl(<ConfirmWithdrawView {...baseProps} networkFee={0.51} payAmount="10.51" />)
        expect(screen.getByText('$0.51')).toBeInTheDocument()
        expect(screen.queryByText('Sponsored by Peanut!')).not.toBeInTheDocument()
    })
})

describe('USDC confirmation precision', () => {
    it.each(['0.000001', '0.100001', '12.345678'])('preserves all six decimals for %s', (amount) => {
        const onConfirm = jest.fn()
        renderWithIntl(
            <ConfirmWithdrawView
                {...baseProps}
                amount={amount}
                payAmount={amount}
                receiveAmount={amount}
                onConfirm={onConfirm}
            />
        )
        expect(screen.getByTestId('spend-amount')).toHaveTextContent(amount)
        expect(screen.getAllByText(`$${amount}`)).toHaveLength(2)
        fireEvent.click(screen.getByRole('button', { name: /withdraw/i }))
        expect(onConfirm).toHaveBeenCalledTimes(1)
    })
})
