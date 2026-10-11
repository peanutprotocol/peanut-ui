/**
 * R4: the selected account, the open action and the open operation on the
 * EURC home live in the URL (nuqs `useQueryStates`), so a reload lands on the
 * same screen. Params: `currency=EURC`, `action=<RECEIVE|SEND|EXCHANGE|
 * BANK_DEPOSIT|BANK_WITHDRAW>`, `operation=<operation id>`. Signed bytes never
 * go in the URL (U6).
 *
 * Also the T6 replacement for CurrencyAccountsHome.test.tsx's login-change
 * test: with the real EurcAccountView, an operation open for one login is
 * never shown to the next.
 */
process.env.NEXT_PUBLIC_EURC_BASE_BUNDLER_URL = 'https://eurc-bundler.test/base'
process.env.NEXT_PUBLIC_EURC_BASE_PAYMASTER_URL = 'https://eurc-paymaster.test/base'

import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import {
    lostResponse,
    makeOperation,
    openOperation,
    passkey,
    renderHome,
    selectEurc,
    server,
    signatureFor,
    submittedBodies,
} from './eurcHomeHarness'

let mockUserId = 'alice'
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
        userId: mockUserId,
        user: { accounts: [{ type: 'peanut-wallet', identifier: `0x${'12'.repeat(20)}` }] },
    }),
}))
jest.mock('@/i18n/app/useAppTranslations', () => ({ useAppTranslations: () => (key: string) => key }))
// The shared Modal and Callout translate through next-intl directly.
jest.mock('next-intl', () => ({ ...jest.requireActual('next-intl'), useTranslations: () => (key: string) => key }))
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
    mockUserId = 'alice'
    server.reset()
    passkey.sign.mockClear()
    passkey.behaviour = undefined
    localStorage.clear()
})

it('writes currency, action and operation to the URL as the user moves through EURC, and never the signed bytes', async () => {
    const op = makeOperation({ amount: '12.34' })
    server.put(op)
    server.handlers.push((request) =>
        request.method === 'POST' && request.path.endsWith('/submit') ? lostResponse() : undefined
    )
    const home = renderHome()
    const param = (name: string) => new URLSearchParams(home.currentSearch()).get(name)

    await selectEurc()
    await waitFor(() => expect(param('currency')).toBe('EURC'))

    fireEvent.click(await screen.findByRole('button', { name: 'send' }))
    await waitFor(() => expect(param('action')).toBe('SEND'))
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }))

    await openOperation('12.34')
    await waitFor(() => expect(param('operation')).toBe(op.id))

    fireEvent.click(await screen.findByRole('button', { name: 'confirm' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('actionError')
    expect(submittedBodies(op.id)).toHaveLength(1)
    const signature = signatureFor(1)
    for (const url of [...home.urls, window.location.href]) {
        expect(url).not.toContain(signature.slice(2, 42))
        expect(url).not.toMatch(/signature|signed|userop/i)
    }
    home.unmount()
})

it.each([
    { status: 'READY', screen: 'review with Confirm', shown: () => screen.queryByRole('button', { name: 'confirm' }) },
    { status: 'PROCESSING', screen: 'pending', shown: () => screen.queryByRole('heading', { name: 'pending' }) },
])('a reload of ?currency=EURC&operation=<id> reopens a $status operation ($screen)', async ({ status, shown }) => {
    const op = makeOperation({ amount: '23.45', status })
    server.put(op)
    const home = renderHome(`?currency=EURC&operation=${op.id}`)
    await waitFor(() => expect(shown()).not.toBeNull(), { timeout: 3_000 })
    expect(screen.getByText(/23\.45/)).toBeInTheDocument()
    home.unmount()
})

it('a reload of ?currency=EURC&action=SEND reopens the send form', async () => {
    const home = renderHome('?currency=EURC&action=SEND')
    expect(await screen.findByLabelText('recipient', {}, { timeout: 3_000 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'review' })).toBeInTheDocument()
    home.unmount()
})

it('a login change never shows the previous login’s open EURC operation', async () => {
    const op = makeOperation({ amount: '34.56' })
    server.put(op, 'alice')
    const home = renderHome()
    await selectEurc()
    await openOperation('34.56')
    expect(await screen.findByRole('button', { name: 'confirm' })).toBeInTheDocument()

    mockUserId = 'bob'
    server.user = 'bob'
    const historyReadsBefore = server.calls('GET', /\/history/).length
    home.rerenderHome()
    await selectEurc()
    await waitFor(() => expect(server.calls('GET', /\/history/).length).toBeGreaterThan(historyReadsBefore))
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100))
    })

    expect(screen.queryByRole('button', { name: 'confirm' })).not.toBeInTheDocument()
    expect(screen.queryByText(/34\.56/)).not.toBeInTheDocument()
    expect(passkey.sign).not.toHaveBeenCalled()
    home.unmount()
})
