/**
 * DirectRequestInitialView — validation vs flow error routing (TASK-22121 #26)
 *
 * Recipient validation errors are field-level: they render under the recipient
 * input and must NOT flip the primary Request CTA to the Reset/retry state
 * (which wipes the typed recipient). Only flow errors (create-request API
 * failures) keep the Notification + Reset CTA.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import type { GeneralRecipientUpdate } from '@/components/Global/GeneralRecipientInput'

// ---------- module mocks ----------

jest.mock('@/hooks/useSafeBack', () => ({
    useSafeBack: () => jest.fn(),
}))

// unauthenticated visitor — the recipient input renders in this state
jest.mock('@/redux/hooks', () => ({
    useUserStore: () => ({ user: null }),
}))

jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({
        spendableBalance: BigInt(100_000_000),
        formattedSpendableBalance: '100.00',
        address: undefined,
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

// the recipient input drives validation through onUpdate — expose it as buttons
jest.mock('@/components/Global/GeneralRecipientInput', () => ({
    __esModule: true,
    default: ({ onUpdate }: { onUpdate: (update: GeneralRecipientUpdate) => void }) => (
        <div data-testid="recipient-input">
            <button
                data-testid="fire-invalid-recipient"
                onClick={() =>
                    onUpdate({
                        recipient: { name: undefined, address: '' },
                        type: 'address',
                        isValid: false,
                        isChanging: false,
                        errorMessage: 'Invalid recipient address',
                    })
                }
            />
            <button
                data-testid="fire-valid-recipient"
                onClick={() =>
                    onUpdate({
                        recipient: { name: 'bob', address: '0x000000000000000000000000000000000000dEaD' },
                        type: 'address',
                        isValid: true,
                        isChanging: false,
                        errorMessage: '',
                    })
                }
            />
        </div>
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
})

describe('DirectRequestInitialView error routing', () => {
    test('recipient validation error renders as a field error and keeps the Request CTA', () => {
        renderView()

        fireEvent.click(screen.getByTestId('fire-invalid-recipient'))

        // field-level message, no flow Notification, no Reset flip
        expect(screen.getByText('Invalid recipient address')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Request' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument()
    })

    test('create-request API failure keeps the Notification and flips to Reset', async () => {
        mockRequestByUsername.mockRejectedValue(new Error('Request failed'))
        renderView()

        // make the form submittable: valid recipient + amount
        fireEvent.click(screen.getByTestId('fire-valid-recipient'))
        fireEvent.change(screen.getByTestId('amount-input'), { target: { value: '5' } })

        fireEvent.click(screen.getByRole('button', { name: 'Request' }))

        await waitFor(() => expect(screen.getByText('Request failed')).toBeInTheDocument())
        expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Request' })).not.toBeInTheDocument()
    })
})
