/**
 * Euro bank actions go through the same verification gate as the dollar bank
 * flows: an unverified user sees them and a tap starts SEPA verification, a
 * residence block says why, and a rollout that is off shows nothing.
 */
process.env.NEXT_PUBLIC_EURC_BASE_BUNDLER_URL = 'https://bundler.test'
process.env.NEXT_PUBLIC_EURC_BASE_PAYMASTER_URL = 'https://paymaster.test'

import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderHome, selectEurc, server } from './eurcHomeHarness'

const remediation = { resolveGate: jest.fn(), verifyCorridor: jest.fn() }
const gate = { current: { kind: 'needs-identity' } as { kind: string } }

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
    useDepositGateRemediation: () => ({ ...remediation, modals: null }),
}))
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({ gateFor: () => gate.current }),
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

const capabilities = (overrides: Record<string, unknown>) =>
    server.handlers.push(({ method, path }) =>
        method === 'GET' && path.endsWith('/capabilities')
            ? {
                  status: 200,
                  body: {
                      receive: true,
                      send: true,
                      exchange: false,
                      bankDeposit: false,
                      bankWithdraw: false,
                      bankingBlock: null,
                      ...overrides,
                  },
              }
            : undefined
    )
const settle = () =>
    act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
    })
const sepaVerificationStarted = () =>
    remediation.verifyCorridor.mock.calls.some(([corridor]) => corridor === 'SEPA_EU') ||
    remediation.resolveGate.mock.calls.some(([, corridor]) => corridor === 'SEPA_EU')

beforeEach(() => {
    server.reset()
    remediation.resolveGate.mockClear()
    remediation.verifyCorridor.mockClear()
    gate.current = { kind: 'needs-identity' }
})

it.each(['bankDeposit', 'bankWithdraw', 'exchange'])(
    'shows %s to an unverified user and starts SEPA verification on tap instead of opening the form',
    async (action) => {
        capabilities({ bankingBlock: 'verification_required' })
        renderHome()
        await selectEurc()
        fireEvent.click(await screen.findByRole('button', { name: action }))
        await settle()
        expect(sepaVerificationStarted()).toBe(true)
        expect(screen.queryByRole('button', { name: 'review' })).not.toBeInTheDocument()
    }
)

it('starts verification even when the app profile still reads ready but the server says verify', async () => {
    capabilities({ bankingBlock: 'verification_required' })
    gate.current = { kind: 'ready' }
    renderHome()
    await selectEurc()
    fireEvent.click(await screen.findByRole('button', { name: 'bankDeposit' }))
    await settle()
    expect(sepaVerificationStarted()).toBe(true)
})

it('explains a residence block instead of hiding the bank actions silently', async () => {
    capabilities({ bankingBlock: 'unavailable' })
    renderHome()
    await selectEurc()
    expect(await screen.findByText('bankingUnavailable')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'bankDeposit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'bankWithdraw' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'exchange' })).not.toBeInTheDocument()
})

it('shows no bank actions and no explanation while euro banking is not offered', async () => {
    capabilities({ bankingBlock: null })
    renderHome()
    await selectEurc()
    await screen.findByRole('button', { name: 'send' })
    expect(screen.queryByRole('button', { name: 'bankDeposit' })).not.toBeInTheDocument()
    expect(screen.queryByText('bankingUnavailable')).not.toBeInTheDocument()
})

it('opens the form directly for a verified user, without the verification flow', async () => {
    capabilities({ exchange: true, bankDeposit: true, bankWithdraw: true, bankingBlock: null })
    gate.current = { kind: 'ready' }
    renderHome()
    await selectEurc()
    fireEvent.click(await screen.findByRole('button', { name: 'bankDeposit' }))
    expect(await screen.findByRole('button', { name: 'review' })).toBeInTheDocument()
    expect(sepaVerificationStarted()).toBe(false)
})

it('starts SEPA verification when the server refuses a prepared transfer for verification', async () => {
    capabilities({ exchange: true, bankDeposit: true, bankWithdraw: true, bankingBlock: null })
    gate.current = { kind: 'ready' }
    server.handlers.push(({ method, path }) =>
        method === 'POST' && path.endsWith('/operations')
            ? { status: 403, body: { error: 'verification_required', code: 'verification_required' } }
            : undefined
    )
    renderHome()
    await selectEurc()
    fireEvent.click(await screen.findByRole('button', { name: 'bankDeposit' }))
    fireEvent.change(await screen.findByLabelText(/amount/), { target: { value: '25' } })
    fireEvent.click(await screen.findByRole('button', { name: 'review' }))
    await waitFor(() => expect(sepaVerificationStarted()).toBe(true))
})
