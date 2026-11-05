/**
 * TASK-23856: the amount screen remounts when the payer comes back from the
 * deposit address. A field that only ever held the suggestion follows the new
 * remainder; an amount the payer typed survives.
 */
import React, { type ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntlWrapper } from '@/test-utils/intl'
import type { TRequestResponse } from '@/services/services.types'

const mockGet = jest.fn()
const mockPayAmounts = jest.fn()
jest.mock('@/services/requests', () => ({
    requestsApi: {
        get: (...args: unknown[]) => mockGet(...args),
        payAmounts: (...args: unknown[]) => mockPayAmounts(...args),
    },
}))
jest.mock('@/features/payments/shared/hooks/useChargeManager', () => ({
    useChargeManager: () => ({ createCharge: jest.fn(), fetchCharge: jest.fn() }),
}))
jest.mock('@/features/payments/shared/hooks/usePaymentRecorder', () => ({
    usePaymentRecorder: () => ({ recordPayment: jest.fn() }),
}))
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({ address: undefined, sendMoney: jest.fn(), hasSufficientSpendableBalance: () => true }),
}))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: null, isFetchingUser: false }) }))
jest.mock('@/hooks/useFriendlyError', () => ({ useFriendlyError: () => String }))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/User/UserCard', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/SupportCTA', () => ({ __esModule: true, default: () => null }))
jest.mock('../../components/RequestPotActionList', () => ({ RequestPotActionList: () => null }))

import { ContributePotFlowProvider, useContributePotFlowContext } from '../../ContributePotFlowContext'
import { ContributePotInputView } from '../ContributePotInputView'

const request = {
    uuid: 'request-1',
    status: 'OPEN',
    tokenAmount: '99.16',
    recipientAddress: '0x1111111111111111111111111111111111111111',
    recipientAccount: { userId: 'ana', identifier: '0x1', type: 'peanut-wallet', user: { username: 'ana' } },
    charges: [],
    totalCollectedAmount: 0,
} as unknown as TRequestResponse

const left = (amount: string) => ({
    requestCurrency: 'USD',
    requestAmount: '99.16',
    remainingAmount: amount,
    rails: [{ kind: 'peanut_balance', payerAmount: { amount, currency: 'USD' } }],
})

// the amount screen, or nothing while the payer is on the deposit address
function Screens() {
    const { currentView, setCurrentView } = useContributePotFlowContext()
    return (
        <>
            <button onClick={() => setCurrentView('EXTERNAL_WALLET')}>leave</button>
            <button onClick={() => setCurrentView('INITIAL')}>return</button>
            {currentView === 'INITIAL' && <ContributePotInputView />}
        </>
    )
}

const renderFlow = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
        <IntlWrapper>
            <QueryClientProvider client={client}>
                <ContributePotFlowProvider initialRequest={request}>{children}</ContributePotFlowProvider>
            </QueryClientProvider>
        </IntlWrapper>
    )
    return render(<Screens />, { wrapper })
}

const field = () => screen.getByRole('textbox') as HTMLInputElement

// the remainder drops while the payer is away: someone paid by bank
const leaveWhileRemainderDrops = async () => {
    mockGet.mockResolvedValue(request)
    mockPayAmounts.mockResolvedValue(left('58.51'))
    fireEvent.click(screen.getByText('leave'))
    expect(screen.queryByRole('textbox')).toBeNull()
    await act(async () => {
        fireEvent.click(screen.getByText('return'))
    })
}

beforeEach(() => {
    jest.clearAllMocks()
    mockPayAmounts.mockResolvedValue(left('99.16'))
})

test('a field that only held the suggestion takes the new remainder', async () => {
    renderFlow()
    await waitFor(() => expect(field().value).toBe('99.16'))

    await leaveWhileRemainderDrops()

    await waitFor(() => expect(field().value).toBe('58.51'))
})

test('a typed amount survives the round trip', async () => {
    renderFlow()
    await waitFor(() => expect(field().value).toBe('99.16'))
    fireEvent.change(field(), { target: { value: '33.05' } })

    await leaveWhileRemainderDrops()

    await waitFor(() => expect(mockPayAmounts).toHaveBeenCalledTimes(2))
    expect(field().value).toBe('33.05')
})
