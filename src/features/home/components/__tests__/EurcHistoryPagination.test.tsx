/**
 * U16 (pairs with api A24): EURC activity pages on the client.
 *
 * Contract, mirroring GET /users/history: the first page is
 * GET /users/currency-accounts/EURC/history; older pages add `?cursor=<cursor>`
 * from the previous response, which carries `cursor: string | null` and
 * `hasMore: boolean`. Unresolved operations always arrive on the first page.
 * The control is labelled with `currencyAccounts.loadMore`.
 */
process.env.NEXT_PUBLIC_EURC_BASE_BUNDLER_URL = 'https://eurc-bundler.test/base'
process.env.NEXT_PUBLIC_EURC_BASE_PAYMASTER_URL = 'https://eurc-paymaster.test/base'

import { fireEvent, screen, waitFor } from '@testing-library/react'
import { makeOperation, renderHome, selectEurc, server } from './eurcHomeHarness'

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
jest.mock('@/features/deposit-accounts/useDepositGateRemediation', () => ({
    useDepositGateRemediation: () => ({ resolveGate: jest.fn(), verifyCorridor: jest.fn(), modals: null }),
}))
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ gateFor: () => ({ kind: 'ready' }) }) }))
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

const entry = (id: string, amount: string, at: string) => ({
    id,
    kind: 'TRANSFER',
    direction: 'CREDIT',
    amount,
    currency: 'EUR',
    asset: 'EURC',
    txHash: null,
    at,
})

beforeEach(() => {
    server.reset()
})

it('reaches older receipts with the server cursor and keeps the first page on screen', async () => {
    const unresolved = makeOperation({ amount: '11.11', status: 'PROCESSING' })
    const recent = makeOperation({ amount: '22.22', status: 'COMPLETED' })
    const older = makeOperation({ amount: '33.33', status: 'COMPLETED' })
    server.historyPages.set('', {
        operations: [unresolved, recent],
        entries: [entry('recent-entry', '4.44', '2026-10-10T10:00:00.000Z')],
        cursor: 'page-2',
        hasMore: true,
    })
    server.historyPages.set('page-2', {
        operations: [older],
        entries: [entry('older-entry', '5.55', '2026-08-01T10:00:00.000Z')],
        cursor: null,
        hasMore: false,
    })

    const home = renderHome()
    await selectEurc()
    expect(await screen.findByRole('button', { name: /11\.11/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /33\.33/ })).not.toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: 'loadMore' }))

    expect(await screen.findByRole('button', { name: /33\.33/ })).toBeInTheDocument()
    expect(screen.getByText(/5\.55/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /11\.11/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /22\.22/ })).toBeInTheDocument()
    expect(screen.getByText(/4\.44/)).toBeInTheDocument()
    expect(server.calls('GET', /\/history\?(?:.*&)?cursor=page-2(?:&|$)/)).toHaveLength(1)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'loadMore' })).not.toBeInTheDocument())
    home.unmount()
})
