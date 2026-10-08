import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CurrencyAccountsHome } from '../CurrencyAccountsHome'
import { currencyAccountsApi, type CurrencyAccount } from '@/services/currency-accounts'
import { getPublicClient } from '@/app/actions/clients'

jest.mock('../EurcAccountView', () => ({ EurcAccountView: () => null }))

let mockUserId = 'alice'
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        userId: mockUserId,
        user: { accounts: [{ type: 'peanut-wallet', identifier: `0x${'12'.repeat(20)}` }] },
    }),
}))
jest.mock('@/i18n/app/useAppTranslations', () => ({ useAppTranslations: () => (key: string) => key }))
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => null }))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/app/actions/clients', () => ({ getPublicClient: jest.fn() }))
jest.mock('@/services/currency-accounts', () => ({ currencyAccountsApi: { list: jest.fn(), addEurc: jest.fn() } }))
jest.mock('../../views/BalanceSection', () => ({
    BalanceSection: ({
        balance,
        currencySymbol = '$',
        actions,
    }: {
        balance: bigint
        currencySymbol?: string
        actions?: React.ReactNode
    }) => (
        <div>
            {`${currencySymbol}:${balance}`}
            {actions === undefined && <button>USDC send</button>}
        </div>
    ),
}))

const eurc: CurrencyAccount = {
    id: 'eurc-1',
    asset: 'EURC',
    currency: 'EUR',
    chainId: '8453',
    decimals: 6,
    tokenAddress: '0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42',
    address: `0x${'12'.repeat(20)}`,
    isDefault: false,
}
const usdc: CurrencyAccount = {
    ...eurc,
    id: 'usdc-1',
    asset: 'USDC',
    currency: 'USD',
    chainId: '42161',
    isDefault: true,
}
const list = jest.mocked(currencyAccountsApi.list)
const add = jest.mocked(currencyAccountsApi.addEurc)
const balance = jest.fn()

function setup() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    const element = () => (
        <QueryClientProvider client={client}>
            <CurrencyAccountsHome
                balanceProps={{
                    balance: 10_000_000n,
                    isFetching: false,
                    isHidden: false,
                    onToggleVisibility: () => {},
                }}
            >
                <div>USDC history and card</div>
            </CurrencyAccountsHome>
        </QueryClientProvider>
    )
    return { client, element, ...render(element()) }
}

beforeEach(() => {
    jest.clearAllMocks()
    mockUserId = 'alice'
    list.mockResolvedValue({ accounts: [usdc], available: [eurc] })
    add.mockResolvedValue(eurc)
    balance.mockResolvedValue(2_500_000n)
    jest.mocked(getPublicClient).mockReturnValue({ readContract: balance } as never)
})

it('defaults to USDC, confirms + enrollment, then displays a separate EURC balance', async () => {
    const { client } = setup()
    expect(screen.getByText('$:10000000')).toBeInTheDocument()
    expect(balance).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: 'addAccount' }))
    expect(screen.getByText('availability')).toBeInTheDocument()
    // Server list reflects the saved enrollment on the mutation's refetch.
    list.mockResolvedValue({ accounts: [usdc, eurc], available: [] })
    fireEvent.click(screen.getByRole('button', { name: 'addEurc' }))
    expect(await screen.findByText('€:2500000')).toBeInTheDocument()
    expect(add).toHaveBeenCalledTimes(1)
    expect(getPublicClient).toHaveBeenCalledWith(8453)
    expect(balance).toHaveBeenCalledWith(expect.objectContaining({ address: eurc.tokenAddress, args: [eurc.address] }))
    expect(screen.queryByText('USDC send')).not.toBeInTheDocument()
    expect(screen.queryByText('USDC history and card')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'addAccount' })).not.toBeInTheDocument()
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'USD · USDC' }))
    expect(screen.getByText('$:10000000')).toBeInTheDocument()
    expect(screen.getByText('USDC history and card')).toBeInTheDocument()
    client.clear()
})

it('keeps failure retryable without adding a phantom account', async () => {
    add.mockRejectedValueOnce(new Error('rollout paused'))
    const { client } = setup()
    fireEvent.click(await screen.findByRole('button', { name: 'addAccount' }))
    fireEvent.click(screen.getByRole('button', { name: 'addEurc' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('addError')
    expect(screen.queryByRole('tab', { name: 'EUR · EURC' })).not.toBeInTheDocument()
    expect(screen.getByText('$:10000000')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'addEurc' })).toBeEnabled()
    client.clear()
})

it('prevents repeated submissions while the add request is pending', async () => {
    let resolveAdd!: (account: CurrencyAccount) => void
    add.mockReturnValueOnce(
        new Promise((resolve) => {
            resolveAdd = resolve
        })
    )
    const { client } = setup()
    fireEvent.click(await screen.findByRole('button', { name: 'addAccount' }))
    fireEvent.click(screen.getByRole('button', { name: 'addEurc' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /adding/ })).toBeDisabled())
    expect(screen.getByRole('button', { name: 'addAccount' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /adding/ }))
    expect(add).toHaveBeenCalledTimes(1)
    list.mockResolvedValue({ accounts: [usdc, eurc], available: [] })
    resolveAdd(eurc)
    expect(await screen.findByText('€:2500000')).toBeInTheDocument()
    client.clear()
})

it('shows a retryable error instead of a zero balance when the Base read fails', async () => {
    list.mockResolvedValue({ accounts: [usdc, eurc], available: [] })
    balance.mockRejectedValue(new Error('RPC unavailable'))
    const { client } = setup()
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'EUR · EURC' }))
    expect(await screen.findByRole('alert', {}, { timeout: 4500 })).toHaveTextContent('balanceError')
    expect(screen.queryByText('€:0')).not.toBeInTheDocument()
    balance.mockResolvedValue(2_500_000n)
    fireEvent.click(screen.getByRole('button', { name: 'retry' }))
    expect(await screen.findByText('€:2500000')).toBeInTheDocument()
    client.clear()
})

it('loads an existing EURC account but still opens USDC by default', async () => {
    list.mockResolvedValue({ accounts: [usdc, eurc], available: [] })
    const { client } = setup()
    expect(await screen.findByRole('tab', { name: 'EUR · EURC' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'USD · USDC' })).toHaveAttribute('aria-selected', 'true')
    expect(balance).not.toHaveBeenCalled()
    client.clear()
})

it('resets selection and scopes cached balances when the login changes', async () => {
    list.mockResolvedValue({ accounts: [usdc, eurc], available: [] })
    const { client, rerender, element } = setup()
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'EUR · EURC' }))
    expect(await screen.findByText('€:2500000')).toBeInTheDocument()
    mockUserId = 'bob'
    list.mockResolvedValue({ accounts: [usdc], available: [eurc] })
    // A new element forces the auth mock to be read again.
    rerender(element())
    expect(screen.getByText('$:10000000')).toBeInTheDocument()
    await waitFor(() => expect(client.getQueryData(['currency-accounts', 'bob'])).toBeDefined())
    expect(screen.queryByText('€:2500000')).not.toBeInTheDocument()
    client.clear()
})

it('leaves the USDC home available when no additional currencies are offered', async () => {
    list.mockResolvedValue({ accounts: [usdc], available: [] })
    const { client } = setup()
    await waitFor(() => expect(list).toHaveBeenCalled())
    expect(screen.queryByRole('group', { name: 'accounts' })).not.toBeInTheDocument()
    expect(screen.getByText('USDC send')).toBeInTheDocument()
    client.clear()
})

it('opens EURC from a notification link only after the account catalog loads', async () => {
    window.history.replaceState({}, '', '/home?currency=EURC')
    list.mockResolvedValue({ accounts: [usdc, eurc], available: [] })
    const { client } = setup()
    expect(await screen.findByText('€:2500000')).toBeInTheDocument()
    client.clear()
    window.history.replaceState({}, '', '/home')
})

it('keeps USDC usable and retries an unavailable account catalog', async () => {
    list.mockRejectedValueOnce(new Error('temporarily unavailable')).mockRejectedValueOnce(
        new Error('temporarily unavailable')
    )
    const { client } = setup()
    expect(await screen.findByRole('alert', {}, { timeout: 5000 })).toHaveTextContent('accountsError')
    expect(screen.getByText('$:10000000')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'retry' }))
    expect(await screen.findByRole('button', { name: 'addAccount' })).toBeInTheDocument()
    client.clear()
})
