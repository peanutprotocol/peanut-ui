import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import ConfirmWithdrawView from '../Confirm.withdraw.view'

jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/PeanutActionDetailsCard', () => ({ __esModule: true, default: () => null }))
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

    it('shows a quoted fee verbatim when Rhino quotes one', () => {
        renderWithIntl(<ConfirmWithdrawView {...baseProps} networkFee={0.51} payAmount="10.51" />)
        expect(screen.getByText('$0.51')).toBeInTheDocument()
        expect(screen.queryByText('Sponsored by Peanut!')).not.toBeInTheDocument()
    })
})
