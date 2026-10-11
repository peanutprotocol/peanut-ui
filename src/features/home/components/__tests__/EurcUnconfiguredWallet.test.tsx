/**
 * U9: Confirm needs the dedicated EURC Base bundler and paymaster. An
 * operation opened from activity must not reach signing through the recovery
 * Base URLs (NEXT_PUBLIC_ZERO_DEV_RECOVERY_BUNDLER_URL) instead.
 */
delete process.env.NEXT_PUBLIC_EURC_BASE_BUNDLER_URL
delete process.env.NEXT_PUBLIC_EURC_BASE_PAYMASTER_URL
process.env.NEXT_PUBLIC_ZERO_DEV_RECOVERY_BUNDLER_URL = 'https://recovery-bundler.test/api/v3/project'

import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { PUBLIC_CLIENTS_BY_CHAIN } from '@/app/actions/clients'
import { historyRow, makeOperation, passkey, renderHome, selectEurc, server } from './eurcHomeHarness'

jest.mock('@/utils/api-fetch', () => ({
    apiFetch: (path: string, options?: RequestInit) => require('./eurcHomeHarness').fakeApiFetch(path, options),
}))
jest.mock('@/hooks/wallet/useSignUserOp', () => ({
    useSignUserOp: () => ({
        signCallsUserOp: (...args: unknown[]) => require('./eurcHomeHarness').passkey.sign(...args),
    }),
}))
jest.mock('@/context/kernelClient.context', () => ({
    useKernelClient: () => ({ ensureClientForChain: async () => undefined }),
}))
jest.mock('@/app/actions/clients', () => ({
    ...jest.requireActual('@/app/actions/clients'),
    getPublicClient: () => ({ readContract: async () => 5_000_000n }),
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        userId: 'alice',
        user: { accounts: [{ type: 'peanut-wallet', identifier: `0x${'12'.repeat(20)}` }] },
    }),
}))
jest.mock('@/i18n/app/useAppTranslations', () => ({ useAppTranslations: () => (key: string) => key }))
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => null }))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/components/Global/QRCodeWrapper', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/CurrencyBalanceNotice', () => ({ CurrencyBalanceNotice: () => null }))
jest.mock('../EurcBankAccountView', () => ({ EurcBankAccountView: () => null }))
jest.mock('../../views/BalanceSection', () => ({
    BalanceSection: ({ balance, currencySymbol = '$' }: { balance: bigint; currencySymbol?: string }) => (
        <div>{`${currencySymbol}:${balance}`}</div>
    ),
}))

beforeEach(() => {
    server.reset()
    passkey.sign.mockClear()
})

const settle = () =>
    act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100))
    })

it('with the dedicated EURC bundler and paymaster URLs missing, an operation from activity offers no Confirm, opened READY or polled into READY', async () => {
    // The recovery configuration alone still gives Base a bundler, so nothing below the UI would refuse.
    expect(PUBLIC_CLIENTS_BY_CHAIN[8453]?.bundlerUrl).toBe('https://recovery-bundler.test/api/v3/project/chain/8453')

    const listedReady = makeOperation({ amount: '12.34', status: 'READY' })
    const polledReady = makeOperation({ amount: '23.45', status: 'READY' })
    server.put(listedReady)
    server.put(polledReady)
    server.historyPages.set('', {
        entries: [],
        operations: [listedReady, { ...polledReady, status: 'PREPARING' }],
        cursor: null,
        hasMore: false,
    })

    let home = renderHome()
    await selectEurc()
    fireEvent.click(await historyRow('12.34'))
    await settle()
    expect(screen.queryByRole('button', { name: 'confirm' })).not.toBeInTheDocument()
    home.unmount()
    home.client.clear()

    home = renderHome()
    await selectEurc()
    fireEvent.click(await historyRow('23.45'))
    await waitFor(() =>
        expect(server.calls('GET', new RegExp(`/operations/${polledReady.id}$`)).length).toBeGreaterThan(0)
    )
    await settle()
    expect(screen.queryByRole('button', { name: 'confirm' })).not.toBeInTheDocument()

    expect(passkey.sign).not.toHaveBeenCalled()
    expect(server.calls('POST', /\/submit$/)).toHaveLength(0)
    home.unmount()
})
