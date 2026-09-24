import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { useDirectSendFlow } from '../../useDirectSendFlow'
import { SendInputView } from '../SendInputView'

jest.mock('next/navigation', () => ({ usePathname: () => '/send/kush' }))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ isFetchingUser: false }) }))
jest.mock('../../useDirectSendFlow', () => ({ useDirectSendFlow: jest.fn() }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/User/UserCard', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/SupportCTA', () => ({ __esModule: true, default: () => null }))
jest.mock('@/features/payments/shared/components/PaymentMethodActionList', () => ({
    PaymentMethodActionList: () => null,
}))
jest.mock('@/features/payments/shared/components/SendWithPeanutCta', () => ({
    __esModule: true,
    default: ({ disabled }: { disabled: boolean }) => <button disabled={disabled}>Send with Peanut</button>,
}))
jest.mock('../../components/SendAmountKeypad', () => ({
    SendAmountKeypad: ({
        children,
        validationAction,
    }: {
        children: React.ReactNode
        validationAction?: React.ReactNode
    }) => (
        <div>
            {validationAction}
            {children}
        </div>
    ),
}))
jest.mock('../../components/SendCommentEntry', () => ({
    SendCommentEntry: () => <span>Add comment</span>,
}))

const mockFlow = useDirectSendFlow as jest.MockedFunction<typeof useDirectSendFlow>

function setFlow(isInsufficientBalance: boolean) {
    mockFlow.mockReturnValue({
        amount: '5',
        recipient: { username: 'kush', address: '0x0000000000000000000000000000000000000001' },
        attachment: { message: '' },
        error: { showError: false, errorMessage: '' },
        formattedBalance: '0.00',
        balanceFillAmount: 0,
        canProceed: true,
        hasSufficientBalance: !isInsufficientBalance,
        isInsufficientBalance,
        isLoggedIn: true,
        isLoading: false,
        setAmount: jest.fn(),
        setAttachment: jest.fn(),
        executePayment: jest.fn(),
    } as unknown as ReturnType<typeof useDirectSendFlow>)
}

it('offers the add money drawer route and hides comment when balance is too low', () => {
    setFlow(true)
    renderWithIntl(<SendInputView />)

    expect(screen.getByRole('link', { name: 'Add money' })).toHaveAttribute(
        'href',
        '/add-money?returnTo=%2Fsend%2Fkush'
    )
    expect(screen.queryByText('Add comment')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send with Peanut' })).toBeDisabled()
})

it('offers comment and a send action when the balance is sufficient', () => {
    setFlow(false)
    renderWithIntl(<SendInputView />)

    expect(screen.getByText('Add comment')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Add money' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send with Peanut' })).toBeEnabled()
})
