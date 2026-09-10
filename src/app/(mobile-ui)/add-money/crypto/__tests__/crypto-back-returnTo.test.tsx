/**
 * AddMoneyCryptoPage — back handler honors a sanitized ?returnTo (chip P15)
 *
 * The home Add drawer carries the caller's returnTo into /add-money/crypto.
 * Back must push that same-origin path; an off-origin value is rejected by
 * readReturnTo and back falls through to useSafeBack.
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ---------- module mocks ----------

const mockRouterPush = jest.fn()
let mockSearchParams = new URLSearchParams()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockRouterPush, replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
    useSearchParams: () => mockSearchParams,
    usePathname: () => '/add-money/crypto',
}))

const mockSafeBack = jest.fn()
jest.mock('@/hooks/useSafeBack', () => ({
    useSafeBack: () => mockSafeBack,
}))

// param-aware read-only stand-in: returnTo comes from the test's search params,
// network stays null so the page renders ChooseNetworkView (the onBack under test)
jest.mock('nuqs', () => ({
    useQueryState: (key: string) => [mockSearchParams.get(key), jest.fn()],
    parseAsString: {},
    parseAsStringEnum: () => ({}),
}))

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: null }),
}))

jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({ address: undefined }),
}))

jest.mock('@/services/rhino', () => ({
    rhinoApi: { createDepositAddress: jest.fn() },
}))

jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: jest.fn() },
}))

jest.mock('@/components/AddMoney/views/ChooseNetwork.view', () => ({
    __esModule: true,
    default: ({ onBack }: { onBack: () => void }) => (
        <button data-testid="choose-network-back" onClick={onBack}>
            back
        </button>
    ),
}))
jest.mock('@/components/AddMoney/views/CryptoDeposit.view', () => ({
    __esModule: true,
    default: () => <div data-testid="crypto-deposit" />,
}))
jest.mock('@/features/payments/shared/components/PaymentSuccessView', () => ({
    __esModule: true,
    default: () => <div data-testid="payment-success" />,
}))

import AddMoneyCryptoPage from '../page'

// ---------- harness ----------

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

const renderPage = (returnTo?: string) => {
    mockSearchParams = new URLSearchParams(returnTo ? { returnTo } : {})
    return render(
        <IntlWrapper>
            <QueryClientProvider client={queryClient}>
                <AddMoneyCryptoPage />
            </QueryClientProvider>
        </IntlWrapper>
    )
}

beforeEach(() => {
    jest.clearAllMocks()
})

// ---------- tests ----------

describe('AddMoneyCryptoPage back handler', () => {
    test('back pushes a same-origin ?returnTo instead of history-back', () => {
        renderPage('/profile/exchange-rate?from=USD&to=EUR')

        fireEvent.click(screen.getByTestId('choose-network-back'))

        expect(mockRouterPush).toHaveBeenCalledWith('/profile/exchange-rate?from=USD&to=EUR')
        expect(mockSafeBack).not.toHaveBeenCalled()
    })

    test('an off-origin ?returnTo is ignored — back falls through to useSafeBack', () => {
        renderPage('https://evil.example/phish')

        fireEvent.click(screen.getByTestId('choose-network-back'))

        expect(mockSafeBack).toHaveBeenCalled()
        expect(mockRouterPush).not.toHaveBeenCalled()
    })

    test('no returnTo behaves like before — plain useSafeBack', () => {
        renderPage()

        fireEvent.click(screen.getByTestId('choose-network-back'))

        expect(mockSafeBack).toHaveBeenCalled()
        expect(mockRouterPush).not.toHaveBeenCalled()
    })
})
