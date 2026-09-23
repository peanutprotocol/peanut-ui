import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { ApiError } from '@/services/api-error'

// ---------- module mocks ----------

jest.mock('@/hooks/useSafeBack', () => ({
    useSafeBack: () => jest.fn(),
}))

const mockReplace = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: mockReplace }) }))
let mockAuth: any
let mockContact: any
jest.mock('@/context/authContext', () => ({ useAuth: () => mockAuth }))
jest.mock('@/hooks/useRequestContact', () => ({ useRequestContact: () => mockContact }))

jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({
        spendableBalance: BigInt(100_000_000),
        formattedSpendableBalance: '100.00',
        address: '0x000000000000000000000000000000000000dEaD',
    }),
}))

jest.mock('@/hooks/useUserByUsername', () => ({
    useUserByUsername: () => ({
        user: { userId: 'u1', username: 'alice', fullName: 'Alice', isVerified: false },
        isLoading: false,
        error: null,
    }),
}))

jest.mock('@/hooks/useUserInteractions', () => ({
    useUserInteractions: () => ({ interactions: {} }),
}))

const mockRequestByUsername = jest.fn()
jest.mock('@/services/users', () => ({
    usersApi: { requestByUsername: (...args: unknown[]) => mockRequestByUsername(...args) },
}))

jest.mock('@/context/loadingStates.context', () => {
    const ReactActual = jest.requireActual('react')
    return {
        loadingStateContext: ReactActual.createContext({
            loadingState: 'Idle',
            setLoadingState: jest.fn(),
            isLoading: false,
        }),
    }
})

jest.mock('@sentry/nextjs', () => ({
    captureException: jest.fn(),
}))

jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: () => <div data-testid="nav-header" />,
}))

jest.mock('@/components/Global/Loading', () => ({
    __esModule: true,
    default: () => <div data-testid="loading" />,
}))

jest.mock('@/components/User/UserCard', () => ({
    __esModule: true,
    default: () => <div data-testid="user-card" />,
}))

jest.mock('@/components/Global/FileUploadInput', () => ({
    __esModule: true,
    default: () => <div data-testid="file-upload" />,
}))

jest.mock('@/components/Payment/Views/Error.validation.view', () => ({
    __esModule: true,
    default: () => <div data-testid="validation-error-view" />,
}))

jest.mock('@/features/payments/shared/components/PaymentSuccessView', () => ({
    __esModule: true,
    default: () => <div data-testid="payment-success" />,
}))

jest.mock('@/components/Global/AmountInput', () => ({
    __esModule: true,
    default: ({ setPrimaryAmount }: { setPrimaryAmount: (value: string) => void }) => (
        <input data-testid="amount-input" onChange={(e) => setPrimaryAmount(e.target.value)} />
    ),
}))

import DirectRequestInitialView from '../Initial.direct.request.view'

const renderView = () =>
    render(
        <IntlWrapper>
            <DirectRequestInitialView username="alice" />
        </IntlWrapper>
    )

beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    mockAuth = { user: { user: { userId: 'sender' }, accounts: [{ type: 'peanut-wallet' }] }, isFetchingUser: false }
    mockContact = {
        data: { relationshipTypes: ['received_money'] },
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
    }
    mockRequestByUsername.mockResolvedValue({})
})

describe('addressed requests', () => {
    test('redirects guests to setup and preserves the destination without an external address form', async () => {
        mockAuth.user = null
        window.history.replaceState({}, '', '/request/alice')
        renderView()
        await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/setup'))
        expect(localStorage.getItem('redirect')).toContain('/request/alice')
        expect(screen.queryByTestId('amount-input')).not.toBeInTheDocument()
        expect(mockRequestByUsername).not.toHaveBeenCalled()
    })

    test('redirects an incomplete account to finish setup', async () => {
        mockAuth.user.accounts = []
        renderView()
        await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/setup/finish'))
        expect(screen.queryByTestId('amount-input')).not.toBeInTheDocument()
    })

    test.each(['loading', 'blocked', 'error'])('does not offer a request form while eligibility is %s', (state) => {
        mockContact = { ...mockContact, data: null, isLoading: state === 'loading', isError: state === 'error' }
        renderView()
        expect(screen.queryByTestId('amount-input')).not.toBeInTheDocument()
        expect(mockRequestByUsername).not.toHaveBeenCalled()
        if (state === 'blocked') expect(screen.getByText(/You can only request money/)).toBeInTheDocument()
        if (state === 'error') {
            fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
            expect(mockContact.refetch).toHaveBeenCalled()
        }
    })

    test('allows a received-money contact and sends the signed-in wallet address', async () => {
        renderView()
        fireEvent.change(screen.getByTestId('amount-input'), { target: { value: '5' } })
        fireEvent.click(screen.getByRole('button', { name: 'Request' }))
        await waitFor(() => expect(screen.getByTestId('payment-success')).toBeInTheDocument())
        expect(mockRequestByUsername).toHaveBeenCalledWith(
            expect.objectContaining({
                username: 'alice',
                amount: '5',
                toAddress: '0x000000000000000000000000000000000000dEaD',
            })
        )
    })

    test.each([
        [401, 'Unauthorized', 'Sign in to request money.'],
        [
            403,
            'You can only request money from people you have paid or been paid by',
            'You can only request money from people you have paid or been paid by.',
        ],
        [403, 'Request sender does not own recipient address', 'Use your own Peanut wallet to receive this request.'],
        [429, 'Too many payment requests to this user', 'Too many payment requests. Please try again later.'],
        [500, 'Raw internal server error', 'Failed to create request.'],
    ])('translates HTTP %s policy failures', async (status, message, translation) => {
        mockRequestByUsername.mockRejectedValue(new ApiError(message as string, { status: status as number }))
        renderView()
        fireEvent.change(screen.getByTestId('amount-input'), { target: { value: '5' } })
        fireEvent.click(screen.getByRole('button', { name: 'Request' }))
        await waitFor(() => expect(screen.getByText(translation)).toBeInTheDocument())
        expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument()
    })
})
