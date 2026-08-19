import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { TransactionDetailsHeaderCard } from '../TransactionDetailsHeaderCard'

const push = jest.fn()

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push }),
}))

jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: Record<string, unknown>) => React.createElement('img', props as Record<string, string>),
}))

jest.mock('../TransactionAvatarBadge', () => ({
    __esModule: true,
    default: ({ countryCode }: { countryCode?: string | null }) => (
        <span data-testid="transaction-avatar">{countryCode ? 'bank flag' : 'user initials'}</span>
    ),
}))

jest.mock('@/components/UserHeader', () => ({
    VerifiedUserLabel: ({ name, onNameClick }: { name: string; onNameClick?: () => void }) => (
        <button type="button" onClick={onNameClick}>
            {name}
        </button>
    ),
}))

const renderHeader = (props: { isNameClickable: boolean; isAvatarClickable: boolean; bank?: boolean }) =>
    render(
        <TransactionDetailsHeaderCard
            direction={props.bank ? 'bank_request_fulfillment' : 'send'}
            userName="natalia"
            amountDisplay="$25.00"
            initials="N"
            status="completed"
            transactionType={props.bank ? 'bank_request_fulfillment' : 'send'}
            countryCode={props.bank ? 'US' : undefined}
            isNameClickable={props.isNameClickable}
            isAvatarClickable={props.isAvatarClickable}
        />,
        { wrapper: IntlWrapper }
    )

describe('TransactionDetailsHeaderCard profile navigation', () => {
    beforeEach(() => {
        push.mockClear()
    })

    it('links the counterparty name but leaves a bank flag inert', () => {
        renderHeader({ bank: true, isNameClickable: true, isAvatarClickable: false })

        fireEvent.click(screen.getByTestId('transaction-avatar'))
        expect(push).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'natalia' }))
        expect(push).toHaveBeenCalledWith('/natalia')
    })

    it('links a real user avatar or initials', () => {
        renderHeader({ isNameClickable: true, isAvatarClickable: true })

        fireEvent.click(screen.getByTestId('transaction-avatar'))
        expect(push).toHaveBeenCalledWith('/natalia')
    })

    it('leaves the rest of the receipt header inert', () => {
        renderHeader({ isNameClickable: true, isAvatarClickable: true })

        fireEvent.click(screen.getByText('$25.00'))
        expect(push).not.toHaveBeenCalled()
    })
})
