/**
 * TASK-22452: the balance row fills the amount field from a USD balance. The
 * field is always USD: a request is paid in USDC or USDT only (TASK-23850), so
 * the token-denominated field that could not take a USD fill is gone.
 */
import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
    useSearchParams: () => ({ get: () => null }),
}))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/User/UserCard', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/SupportCTA', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/TokenSelector/TokenSelector', () => ({ __esModule: true, default: () => null }))
jest.mock('@/features/payments/shared/components/SendWithPeanutCta', () => ({ __esModule: true, default: () => null }))
jest.mock('@/features/payments/shared/components/PaymentMethodActionList', () => ({
    PaymentMethodActionList: () => null,
}))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))

jest.mock('@/components/Global/AmountInput', () => ({
    __esModule: true,
    default: ({ balanceFillAmount, primaryDenomination }: any) => (
        <div
            data-testid="amount-input"
            data-balance-fill={balanceFillAmount}
            data-symbol={primaryDenomination?.symbol}
        />
    ),
}))

const flow: Record<string, unknown> = {}
jest.mock('../../useSemanticRequestFlow', () => ({ useSemanticRequestFlow: () => flow }))

import { SemanticRequestInputView } from '../SemanticRequestInputView'

const setFlow = (over: Record<string, unknown>) => {
    for (const k of Object.keys(flow)) delete flow[k]
    Object.assign(
        flow,
        {
            amount: '',
            recipient: { recipientType: 'USERNAME', identifier: 'alice' },
            parsedUrl: null,
            chargeIdFromUrl: null,
            isAmountFromUrl: false,
            error: { showError: false, errorMessage: '' },
            formattedBalance: '100.00',
            balanceFillAmount: 100,
            canProceed: false,
            isInsufficientBalance: false,
            isLoading: false,
            isLoggedIn: true,
            isConnected: true,
            setAmount: jest.fn(),
            handlePayment: jest.fn(),
            setCurrentView: jest.fn(),
        },
        over
    )
}

describe('SemanticRequestInputView balance fill', () => {
    it('fills the usd balance as-is on a usd-denominated request', () => {
        setFlow({})
        renderWithIntl(<SemanticRequestInputView />)

        const input = screen.getByTestId('amount-input')
        expect(input).toHaveAttribute('data-symbol', '$')
        expect(input).toHaveAttribute('data-balance-fill', '100')
    })

    it('offers no fill to a logged-out visitor', () => {
        setFlow({ isLoggedIn: false })
        renderWithIntl(<SemanticRequestInputView />)

        expect(screen.getByTestId('amount-input')).not.toHaveAttribute('data-balance-fill')
    })
})
