/**
 * TASK-22452: the balance row fills the amount field from a USD balance, so it
 * is only offered while the field is USD too. A url that names a token
 * (/alice/eth) makes the field token-denominated, and then the two can never
 * agree — passing the USD total raw entered "100 ETH" for a $100 balance, and
 * converting it runs into AmountInput's 2-decimal floor, which drops 0.025 ETH
 * to 0.02 and anything under 0.01 token to nothing. Both were caught in review.
 * The token case therefore gets no fill; these lock that.
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
            urlToken: null,
            tokenUsdPrice: undefined,
            isTokenDenominated: false,
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

const ETH = { symbol: 'eth', decimals: 18 }

describe('SemanticRequestInputView balance fill', () => {
    it('fills the usd balance as-is on a usd-denominated request', () => {
        setFlow({})
        renderWithIntl(<SemanticRequestInputView />)

        const input = screen.getByTestId('amount-input')
        expect(input).toHaveAttribute('data-symbol', '$')
        expect(input).toHaveAttribute('data-balance-fill', '100')
    })

    it('never fills a usd balance into a token-denominated field', () => {
        // the field is ETH; the balance row is usd. "100" here would read as
        // 100 ETH, and converting it loses most of the balance to the 2-decimal
        // floor — so the row stays plain text.
        setFlow({ isTokenDenominated: true, urlToken: ETH, tokenUsdPrice: 2500 })
        renderWithIntl(<SemanticRequestInputView />)

        const input = screen.getByTestId('amount-input')
        expect(input).toHaveAttribute('data-symbol', 'ETH')
        expect(input).not.toHaveAttribute('data-balance-fill')
    })

    it('offers no fill on a token url whose price has not arrived', () => {
        setFlow({ isTokenDenominated: true, urlToken: ETH, tokenUsdPrice: undefined })
        renderWithIntl(<SemanticRequestInputView />)

        expect(screen.getByTestId('amount-input')).not.toHaveAttribute('data-balance-fill')
    })

    it('offers no fill to a logged-out visitor', () => {
        setFlow({ isLoggedIn: false })
        renderWithIntl(<SemanticRequestInputView />)

        expect(screen.getByTestId('amount-input')).not.toHaveAttribute('data-balance-fill')
    })
})
