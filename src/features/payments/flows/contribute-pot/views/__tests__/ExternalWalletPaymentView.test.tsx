// TASK-23856: the deposit poll's success read nothing back. It now hands off to
// the flow, which reads the charge before the result. A charge the flow read
// back short keeps the payer here: the card states what arrived and exits on Done.
import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderWithIntl } from '@/test-utils/intl'

const mockComplete = jest.fn()
const mockLeaveFlow = jest.fn()
const mockDepositView = jest.fn()
const mockFlow: Record<string, unknown> = {}
const setFlow = (charge: Record<string, unknown> = {}) =>
    Object.assign(mockFlow, {
        charge: {
            uuid: 'charge-1',
            tokenAmount: '58.51',
            tokenSymbol: 'USDC',
            requestLink: { uuid: 'request-1' },
            ...charge,
        },
        amount: '58.51',
        request: { recipientAccount: { type: 'peanut-wallet', user: { username: 'ana' }, identifier: '0xana' } },
        setCurrentView: jest.fn(),
        resetContributePotFlow: jest.fn(),
        completeExternalWalletPayment: mockComplete,
    })
jest.mock('../../useContributePotFlow', () => ({ useContributePotFlow: () => mockFlow }))
jest.mock('@/features/payments/shared/hooks/useFlowExit', () => ({ useFlowExit: () => mockLeaveFlow }))
jest.mock('@/hooks/wallet/useWallet', () => ({ useWallet: () => ({ address: '0xpayer' }) }))
jest.mock('@/services/rhino', () => ({
    rhinoApi: {
        createRequestFulfilmentAddress: jest.fn().mockResolvedValue({
            depositAddress: '0xdeposit',
            minDepositLimitUsd: 1,
            maxDepositLimitUsd: 1000,
        }),
    },
}))
type DepositViewProps = {
    onSuccess: (amount: number) => void
    onDone?: () => void
    depositAddressData?: unknown
    tokenAmount?: string
    shortDeposit?: { received: string; asked: string }
}
jest.mock('@/components/AddMoney/views/RhinoDeposit.view', () => ({
    __esModule: true,
    default: (props: DepositViewProps) => {
        mockDepositView(props)
        return (
            <>
                <button disabled={!props.depositAddressData} onClick={() => props.onSuccess(33)}>
                    deposit seen
                </button>
                {props.onDone && <button onClick={props.onDone}>done</button>}
            </>
        )
    },
}))

import ExternalWalletPaymentView from '../ExternalWalletPaymentView'

const renderView = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return renderWithIntl(
        <QueryClientProvider client={client}>
            <ExternalWalletPaymentView />
        </QueryClientProvider>
    )
}

beforeEach(() => {
    jest.clearAllMocks()
    setFlow()
})

test('a seen deposit hands off to the flow, which reads the charge back', async () => {
    renderView()
    await waitFor(() => expect(screen.getByRole('button', { name: 'deposit seen' })).toBeEnabled())

    fireEvent.click(screen.getByRole('button', { name: 'deposit seen' }))

    expect(mockComplete).toHaveBeenCalledTimes(1)
    // the card under "Send the exact amount!" names the figure in the charge's token
    expect(mockDepositView).toHaveBeenLastCalledWith(
        expect.objectContaining({ tokenAmount: '58.51 USDC', shortDeposit: undefined })
    )
    expect(screen.queryByRole('button', { name: 'done' })).toBeNull()
})

test('a charge read back short keeps the card, states what arrived, and exits the flow on Done', async () => {
    setFlow({ status: 'COMPLETED', settledAmount: '33', partialPayment: true })
    renderView()
    await waitFor(() => expect(screen.getByRole('button', { name: 'deposit seen' })).toBeEnabled())

    expect(mockDepositView).toHaveBeenLastCalledWith(
        expect.objectContaining({ shortDeposit: { received: '33', asked: '58.51' } })
    )

    fireEvent.click(screen.getByRole('button', { name: 'done' }))
    expect(mockLeaveFlow).toHaveBeenCalledTimes(1)
})
