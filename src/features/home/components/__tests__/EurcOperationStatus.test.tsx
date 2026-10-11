/**
 * U8: every backend operation status routes to the screen that can act on it,
 * including statuses another device reached while this one was polling.
 * U12: status reads honour React Query's abort signal.
 *
 * The status vocabulary is peanut-api-ts `currency_operations.status`
 * (src/currency-accounts/operations.ts, worker.ts, money-routes.ts).
 */
process.env.NEXT_PUBLIC_EURC_BASE_BUNDLER_URL = 'https://eurc-bundler.test/base'
process.env.NEXT_PUBLIC_EURC_BASE_PAYMASTER_URL = 'https://eurc-paymaster.test/base'

import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import {
    SEPA_INSTRUCTIONS,
    historyRow,
    makeOperation,
    renderHome,
    selectEurc,
    selectUsdc,
    server,
} from './eurcHomeHarness'

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

const confirmShown = () => !!screen.queryByRole('button', { name: 'confirm' })
const resumeShown = () => !!screen.queryByRole('button', { name: 'resume' })
const heading = (name: string) => !!screen.queryByRole('heading', { name })
const pendingOnly = () => heading('pending') && !confirmShown() && !resumeShown()

const SCREENS: Record<string, { screen: string; shown: () => boolean }> = {
    PREPARING: { screen: 'pending with Retry setup', shown: () => resumeShown() && !confirmShown() },
    READY: { screen: 'review with Confirm', shown: confirmShown },
    AWAITING_FUNDS: {
        screen: 'bank transfer instructions',
        shown: () => !!screen.queryByText(SEPA_INSTRUCTIONS.iban) && !confirmShown(),
    },
    SUBMITTED: { screen: 'pending', shown: pendingOnly },
    PROCESSING: { screen: 'pending', shown: pendingOnly },
    CANCELLING: { screen: 'pending', shown: pendingOnly },
    NEEDS_REVIEW: {
        screen: 'contact support',
        shown: () => heading('needsReview') && !confirmShown() && !resumeShown(),
    },
    COMPLETED: { screen: 'completed', shown: () => heading('completed') && !confirmShown() },
    FAILED: { screen: 'failed', shown: () => heading('failed') && !confirmShown() },
    CANCELLED: { screen: 'cancelled', shown: () => heading('cancelled') && !confirmShown() },
}
const STATUSES = Object.keys(SCREENS)

const onScreen = () =>
    [
        ...screen.queryAllByRole('heading').map((node) => `heading:${node.textContent}`),
        ...screen.queryAllByRole('button').map((node) => `button:${node.textContent}`),
    ].join(', ')

beforeEach(() => {
    server.reset()
})

it('routes each of the 10 backend operation statuses to its screen once the status read returns it', async () => {
    expect(STATUSES).toHaveLength(10)
    const mismatches: string[] = []
    for (const [index, status] of STATUSES.entries()) {
        server.reset()
        const amount = `${index + 1}.25`
        const op = makeOperation({ kind: status === 'AWAITING_FUNDS' ? 'BANK_DEPOSIT' : 'SEND', amount, status })
        server.put(op)
        // Activity still lists the operation as it was when this device last saw it.
        server.historyPages.set('', {
            entries: [],
            operations: [{ ...op, status: 'PREPARING' }],
            cursor: null,
            hasMore: false,
        })
        const home = renderHome()
        await selectEurc()
        fireEvent.click(await historyRow(amount))
        try {
            await waitFor(() => expect(SCREENS[status].shown()).toBe(true), { timeout: 2_000 })
        } catch {
            mismatches.push(`${status}: expected ${SCREENS[status].screen}, saw [${onScreen()}]`)
        }
        home.unmount()
        home.client.clear()
    }
    expect(mismatches).toEqual([])
}, 60_000)

it.each([
    { status: 'READY', kind: 'SEND' as const },
    { status: 'AWAITING_FUNDS', kind: 'BANK_DEPOSIT' as const },
])(
    'a PREPARING operation another device moves to $status leaves the pending screen on the next poll',
    async ({ status, kind }) => {
        const op = makeOperation({ kind, amount: '56.78', status: 'PREPARING' })
        server.put(op)
        const home = renderHome()
        await selectEurc()
        fireEvent.click(await historyRow('56.78'))
        expect(await screen.findByRole('button', { name: 'resume' })).toBeInTheDocument()
        await waitFor(() => expect(server.calls('GET', new RegExp(`/operations/${op.id}$`)).length).toBeGreaterThan(0))

        server.patch(op.id, { status })
        await waitFor(() => expect(SCREENS[status].shown()).toBe(true), { timeout: 8_000 })
        home.unmount()
    },
    15_000
)

it('leaving the EURC view during a status read aborts it and never retries it', async () => {
    const op = makeOperation({ amount: '67.89', status: 'SUBMITTED', userOpHash: `0x${'cd'.repeat(32)}` })
    server.put(op)
    const statusReads = () => server.calls('GET', new RegExp(`/operations/${op.id}$`))
    server.handlers.push((request) =>
        request.method === 'GET' && request.path.endsWith(`/operations/${op.id}`) ? new Promise(() => {}) : undefined
    )

    const home = renderHome()
    await selectEurc()
    fireEvent.click(await historyRow('67.89'))
    await waitFor(() => expect(statusReads().length).toBeGreaterThan(0))
    const reads = statusReads().length

    await selectUsdc()
    expect(await screen.findByText('USDC history and card')).toBeInTheDocument()

    await waitFor(() => expect(statusReads().every((request) => request.signal?.aborted === true)).toBe(true))
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1_500))
    })
    expect(statusReads()).toHaveLength(reads)
    home.unmount()
})
