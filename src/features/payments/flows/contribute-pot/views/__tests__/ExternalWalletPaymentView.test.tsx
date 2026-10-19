// TASK-23856: the deposit poll's success read nothing back. It now hands the
// address it watched to the flow, which reads the charge before the result.
import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderWithIntl } from '@/test-utils/intl'

const mockComplete = jest.fn()
const mockDepositView = jest.fn()
jest.mock('../../useContributePotFlow', () => ({
    useContributePotFlow: () => ({
        charge: {
            uuid: 'charge-1',
            tokenAmount: '58.51',
            tokenSymbol: 'USDC',
            requestLink: { uuid: 'request-1' },
        },
        amount: '58.51',
        request: { recipientAccount: { type: 'peanut-wallet', user: { username: 'ana' }, identifier: '0xana' } },
        setCurrentView: jest.fn(),
        completeExternalWalletPayment: mockComplete,
    }),
}))
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
jest.mock('@/components/AddMoney/views/RhinoDeposit.view', () => ({
    __esModule: true,
    default: (props: { onSuccess: (amount: number) => void; depositAddressData?: unknown; tokenAmount?: string }) => {
        mockDepositView(props)
        return (
            <button disabled={!props.depositAddressData} onClick={() => props.onSuccess(33)}>
                deposit seen
            </button>
        )
    },
}))

import ExternalWalletPaymentView from '../ExternalWalletPaymentView'

test('a seen deposit completes the payment with the address it was sent to', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    renderWithIntl(
        <QueryClientProvider client={client}>
            <ExternalWalletPaymentView />
        </QueryClientProvider>
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'deposit seen' })).toBeEnabled())

    fireEvent.click(screen.getByRole('button', { name: 'deposit seen' }))

    expect(mockComplete).toHaveBeenCalledWith('0xdeposit')
    // the card under "Send the exact amount!" names the figure in the charge's token
    expect(mockDepositView).toHaveBeenLastCalledWith(expect.objectContaining({ tokenAmount: '58.51 USDC' }))
})
