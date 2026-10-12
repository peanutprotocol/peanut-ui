/**
 * The recipient card gets the identity as-is: the full address for an address
 * recipient (the shared AddressLink shortens, resolves and links it), and the
 * URL name for a username or ENS recipient. A pre-shortened "0x1234…abcd" gave
 * AddressLink nothing to resolve and a broken link target.
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
jest.mock('@/components/Global/TokenSelector/TokenSelector', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/AmountInput', () => ({ __esModule: true, default: () => null }))
jest.mock('@/features/payments/shared/components/SendWithPeanutCta', () => ({ __esModule: true, default: () => null }))
jest.mock('@/features/payments/shared/components/PaymentMethodActionList', () => ({
    PaymentMethodActionList: () => null,
}))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/components/User/UserCard', () => ({
    __esModule: true,
    default: ({ username, recipientType }: { username: string; recipientType: string }) => (
        <div data-testid="user-card" data-username={username} data-recipient-type={recipientType} />
    ),
}))

const flow: Record<string, unknown> = {}
jest.mock('../../useSemanticRequestFlow', () => ({ useSemanticRequestFlow: () => flow }))

import { SemanticRequestInputView } from '../SemanticRequestInputView'

const ADDRESS = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'

const setRecipient = (recipient: { identifier: string; recipientType: string; resolvedAddress: string }) => {
    for (const k of Object.keys(flow)) delete flow[k]
    Object.assign(flow, {
        amount: '',
        recipient,
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
    })
}

describe('SemanticRequestInputView recipient card', () => {
    it('hands an address recipient the full address, not a shortened one', () => {
        setRecipient({ identifier: ADDRESS, recipientType: 'ADDRESS', resolvedAddress: ADDRESS })
        renderWithIntl(<SemanticRequestInputView />)

        const card = screen.getByTestId('user-card')
        expect(card).toHaveAttribute('data-username', ADDRESS)
        expect(card).toHaveAttribute('data-recipient-type', 'ADDRESS')
    })

    it.each([
        ['USERNAME', 'alice'],
        ['ENS', 'alice.eth'],
    ])('hands a %s recipient its name', (recipientType, identifier) => {
        setRecipient({ identifier, recipientType, resolvedAddress: ADDRESS })
        renderWithIntl(<SemanticRequestInputView />)

        const card = screen.getByTestId('user-card')
        expect(card).toHaveAttribute('data-username', identifier)
        expect(card).toHaveAttribute('data-recipient-type', recipientType)
    })
})
