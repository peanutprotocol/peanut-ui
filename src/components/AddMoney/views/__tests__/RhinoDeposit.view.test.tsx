/**
 * RhinoDepositView — sub-minimum gate (TASK-21669). Rhino accepts a deposit
 * below the chain's SDA floor on-chain but never bridges it (funds strand
 * uncredited), so a fixed-amount request payment below the floor must never
 * see the deposit address. The floor is per-chain and only known from the SDA
 * response, which is why the gate lives here and not in the action list.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntlWrapper } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import type { CreateDepositAddressResponse } from '@/services/services.types'

jest.mock('@/services/rhino', () => ({
    rhinoApi: {
        getDepositAddressStatus: jest.fn().mockResolvedValue({ status: 'pending' }),
        resetDepositAddressStatus: jest.fn(),
    },
}))

jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: ({ title }: { title?: string }) => <div data-testid="nav-header">{title}</div>,
}))

jest.mock('@/components/Global/QRCodeWrapper', () => ({
    __esModule: true,
    default: ({ url }: { url: string }) => <div data-testid="deposit-qr">{url}</div>,
}))

jest.mock('@/components/User/UserCard', () => ({
    __esModule: true,
    default: () => <div data-testid="user-card" />,
}))

import RhinoDepositView from '../RhinoDeposit.view'

const DEPOSIT_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678'

const depositAddressData = {
    depositAddress: DEPOSIT_ADDRESS,
    minDepositLimitUsd: 5,
    maxDepositLimitUsd: 5000,
} as CreateDepositAddressResponse

const renderView = (amount?: number) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <IntlWrapper>
            <QueryClientProvider client={queryClient}>
                <RhinoDepositView
                    headerTitle="Pay"
                    chainType="EVM"
                    setChainType={jest.fn()}
                    depositAddressData={depositAddressData}
                    isDepositAddressDataLoading={false}
                    onSuccess={jest.fn()}
                    amount={amount}
                />
            </QueryClientProvider>
        </IntlWrapper>
    )
}

describe('RhinoDepositView sub-minimum gate', () => {
    it('blocks a fixed amount below the chain floor — no deposit address, minimum message shown', () => {
        renderView(3)

        expect(screen.getByText(en.payment.minAmount.title)).toBeInTheDocument()
        expect(screen.queryByTestId('deposit-qr')).not.toBeInTheDocument()
        expect(screen.queryByText(/0x1234/)).not.toBeInTheDocument()
    })

    it('shows the deposit address at or above the chain floor', () => {
        renderView(5)

        expect(screen.getByTestId('deposit-qr')).toHaveTextContent(DEPOSIT_ADDRESS)
        expect(screen.queryByText(en.payment.minAmount.title)).not.toBeInTheDocument()
    })

    it('leaves open-amount deposit flows (no amount prop) ungated', () => {
        renderView(undefined)

        expect(screen.getByTestId('deposit-qr')).toHaveTextContent(DEPOSIT_ADDRESS)
        expect(screen.queryByText(en.payment.minAmount.title)).not.toBeInTheDocument()
    })
})
