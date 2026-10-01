/**
 * A request sent with no amount (TASK-22123) opens on this view with the
 * amount field unlocked, and names the requester by their handle: the
 * recipient derived from the charge is only their address.
 */
import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
    useSearchParams: () => ({ get: () => null }),
}))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/SupportCTA', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/TokenSelector/TokenSelector', () => ({
    __esModule: true,
    default: () => <div data-testid="token-selector" />,
}))
jest.mock('@/components/Global/AmountInput', () => ({
    __esModule: true,
    default: ({ disabled }: { disabled?: boolean }) => <input data-testid="amount-input" disabled={disabled} />,
}))
jest.mock('@/features/payments/shared/components/SendWithPeanutCta', () => ({ __esModule: true, default: () => null }))
jest.mock('@/features/payments/shared/components/PaymentMethodActionList', () => ({
    PaymentMethodActionList: ({ onPayWithExternalWallet }: { onPayWithExternalWallet?: () => void }) => (
        <div data-testid="payment-methods" data-wallet-option={onPayWithExternalWallet ? 'shown' : 'hidden'} />
    ),
}))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/components/User/UserCard', () => ({
    __esModule: true,
    default: ({ type, username, recipientType }: { type: string; username: string; recipientType: string }) => (
        <div data-testid="user-card" data-type={type} data-username={username} data-recipient-type={recipientType} />
    ),
}))

const flow: Record<string, unknown> = {}
jest.mock('../../useSemanticRequestFlow', () => ({ useSemanticRequestFlow: () => flow }))

import { SemanticRequestInputView } from '../SemanticRequestInputView'

const ADDRESS = '0x1111111111111111111111111111111111111111'

const setCharge = (charge: Record<string, unknown>) => {
    for (const k of Object.keys(flow)) delete flow[k]
    Object.assign(flow, {
        amount: '',
        recipient: { identifier: ADDRESS, recipientType: 'ADDRESS', resolvedAddress: ADDRESS },
        parsedUrl: null,
        charge,
        chargeIdFromUrl: 'charge-1',
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
    })
}

const requestLink = {
    recipientAddress: ADDRESS,
    recipientAccount: { userId: 'requester', user: { username: 'alice', avatarKey: null } },
}

describe('SemanticRequestInputView with an open-amount request', () => {
    it('lets the requestee type the amount and names who is asking', () => {
        setCharge({ uuid: 'charge-1', tokenAmount: null, openAmount: true, requestLink })
        renderWithIntl(<SemanticRequestInputView />)

        expect(screen.getByTestId('amount-input')).toBeEnabled()
        const card = screen.getByTestId('user-card')
        expect(card).toHaveAttribute('data-type', 'request_pay')
        expect(card).toHaveAttribute('data-username', 'alice')
        expect(card).toHaveAttribute('data-recipient-type', 'USERNAME')
        // the charge names the token, so there is nothing to pick
        expect(screen.queryByTestId('token-selector')).not.toBeInTheDocument()
    })

    it.each([
        [true, 'shown'],
        [false, 'hidden'],
    ])('offers the external wallet when signed in is %s: %s', (isLoggedIn, option) => {
        setCharge({ uuid: 'charge-1', tokenAmount: null, openAmount: true, requestLink })
        flow.isLoggedIn = isLoggedIn
        renderWithIntl(<SemanticRequestInputView />)

        // setting the amount needs the signed-in requestee
        expect(screen.getByTestId('payment-methods')).toHaveAttribute('data-wallet-option', option)
    })

    it('keeps the amount of a fixed request locked', () => {
        setCharge({ uuid: 'charge-1', tokenAmount: '10', requestLink })
        renderWithIntl(<SemanticRequestInputView />)

        expect(screen.getByTestId('amount-input')).toBeDisabled()
        expect(screen.getByTestId('user-card')).toHaveAttribute('data-recipient-type', 'ADDRESS')
    })
})
