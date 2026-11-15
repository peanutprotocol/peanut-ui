/**
 * Recover funds sends the exact on-chain balance (TASK-23850). The ERC-20
 * transfer used to be rebuilt from a float (`amount.toFixed(decimals)`), which
 * for an 18-decimal token can ask for more base units than the account holds,
 * and the transfer reverts. Now it sends the raw bigint the balance read
 * returned.
 */
import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { decodeFunctionData, erc20Abi } from 'viem'
import { renderWithIntl } from '@/test-utils/intl'
import type { RecoverableBalance } from '@/types/recover-funds'

const mockRecipient = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
const TOKEN = '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0'
// 0.049917499999999997 in 18 decimals: toFixed(18) on the float reads back as …003
const RAW = 49_917_499_999_999_997n

const mockSendTransactions = jest.fn()
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({
        address: '0x1111111111111111111111111111111111111111',
        sendTransactions: mockSendTransactions,
    }),
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('@/app/actions/clients', () => ({ getPublicClient: jest.fn() }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/AddressLink', () => ({
    __esModule: true,
    default: ({ address }: { address: string }) => <span>{address}</span>,
}))
jest.mock('@/components/Global/GeneralRecipientInput', () => ({
    __esModule: true,
    default: ({ onUpdate }: { onUpdate: (update: unknown) => void }) => (
        <button
            onClick={() =>
                onUpdate({
                    recipient: { address: mockRecipient, name: '' },
                    isValid: true,
                    isChanging: false,
                    errorMessage: '',
                })
            }
        >
            enter recipient
        </button>
    ),
}))

const mockBalance: RecoverableBalance = {
    chainId: '1',
    address: TOKEN,
    name: 'Wrapped liquid staked Ether 2.0',
    symbol: 'wstETH',
    decimals: 18,
    price: 0,
    amount: 0.049917499999999997,
    currency: 'usd',
    logoURI: '',
    value: '0',
    rawAmount: RAW,
}
jest.mock('@/hooks/useRecoverableBalances', () => ({
    useRecoverableBalances: () => ({
        tokenBalances: [mockBalance],
        setTokenBalances: jest.fn(),
        fetchingBalances: false,
        balancesError: false,
        retry: jest.fn(),
    }),
}))

import RecoverFundsPage from '../page'

describe('recover funds transfer amount', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockSendTransactions.mockResolvedValue({ receipt: null, userOpHash: '0xhash' })
    })

    it('transfers exactly the raw balanceOf amount of an 18-decimal token', async () => {
        renderWithIntl(<RecoverFundsPage />)

        fireEvent.click(screen.getByRole('option'))
        fireEvent.click(screen.getByRole('button', { name: 'enter recipient' }))
        fireEvent.click(screen.getByRole('button', { name: 'Review' }))
        fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))

        await screen.findByText('Sent to')
        expect(mockSendTransactions).toHaveBeenCalledTimes(1)
        const [[transactions, chainId]] = mockSendTransactions.mock.calls
        expect(chainId).toBe('1')
        expect(transactions).toEqual([expect.objectContaining({ to: TOKEN })])
        const { functionName, args } = decodeFunctionData({ abi: erc20Abi, data: transactions[0].data })
        expect(functionName).toBe('transfer')
        expect(args).toEqual([mockRecipient, RAW])
    })
})
