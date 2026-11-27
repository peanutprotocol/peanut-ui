import { render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'

jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ isFetchingUser: false }) }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/AmountInput', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/User/UserCard', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/SupportCTA', () => ({ __esModule: true, default: () => null }))
jest.mock('@/features/payments/shared/components/PaymentMethodActionList', () => ({
    PaymentMethodActionList: () => null,
}))
jest.mock('@/features/payments/shared/components/SendWithPeanutCta', () => ({
    __esModule: true,
    default: ({ disabled, insufficientBalance }: { disabled?: boolean; insufficientBalance?: boolean }) => (
        <button disabled={disabled} data-insufficient={String(insufficientBalance)}>
            cta
        </button>
    ),
}))

let mockFlow: Record<string, unknown>
jest.mock('../../useDirectSendFlow', () => ({ useDirectSendFlow: () => mockFlow }))

import { SendInputView } from '../SendInputView'

const flow = (overrides: Record<string, unknown>) => ({
    amount: '50',
    recipient: { username: 'ana', isVerified: false, person: null },
    attachment: {},
    error: { showError: false, errorMessage: '' },
    formattedBalance: '10',
    canProceed: true,
    hasSufficientBalance: true,
    isInsufficientBalance: false,
    isLoggedIn: true,
    isLoading: false,
    setAmount: jest.fn(),
    setAttachment: jest.fn(),
    executePayment: jest.fn(),
    ...overrides,
})

const renderView = () => render(<SendInputView />, { wrapper: IntlWrapper })

// TASK-23929 item 2: the CTA read "Add money to Peanut" but was disabled, a dead end
it('keeps the Add money CTA tappable when the balance is short', () => {
    mockFlow = flow({ hasSufficientBalance: false, isInsufficientBalance: true })
    renderView()
    const cta = screen.getByRole('button', { name: 'cta' })
    expect(cta).toHaveAttribute('data-insufficient', 'true')
    expect(cta).toBeEnabled()
})

it('stays disabled while the balance is still being read', () => {
    mockFlow = flow({ hasSufficientBalance: false, isInsufficientBalance: false })
    renderView()
    expect(screen.getByRole('button', { name: 'cta' })).toBeDisabled()
})
