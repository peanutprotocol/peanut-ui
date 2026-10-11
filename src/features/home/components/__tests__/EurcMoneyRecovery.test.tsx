/**
 * U6, U7, U11: signed bytes must survive a remount or reload, so a lost submit
 * response never leads to a second passkey signature, and a definite rejection
 * must not leave Cancel disabled forever.
 *
 * Recovery record contract: localStorage key
 * `eurc-signed-operation:<userId>:<operationId>`, written once the passkey has
 * signed and removed when the operation reaches a final status (or on logout,
 * see src/context/__tests__/authContext-logout-eurc.test.tsx).
 */
process.env.NEXT_PUBLIC_EURC_BASE_BUNDLER_URL = 'https://eurc-bundler.test/base'
process.env.NEXT_PUBLIC_EURC_BASE_PAYMASTER_URL = 'https://eurc-paymaster.test/base'

import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import {
    lostResponse,
    makeOperation,
    openOperation,
    passkey,
    reload,
    renderHome,
    reopenAndConfirm,
    selectEurc,
    selectUsdc,
    server,
    submittedBodies,
    type FakeRequest,
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

const recordKey = (operationId: string) => `eurc-signed-operation:alice:${operationId}`

beforeEach(() => {
    server.reset()
    passkey.sign.mockClear()
    passkey.behaviour = undefined
    localStorage.clear()
})

it('a lost submit response followed by a reload resubmits the stored bytes without a second passkey signature', async () => {
    const op = makeOperation({ amount: '12.34' })
    server.put(op)
    // Lost before the server journals anything: the operation is still READY with no hash.
    server.handlers.push((request) =>
        request.method === 'POST' && request.path.endsWith('/submit') && submittedBodies(op.id).length === 1
            ? lostResponse()
            : undefined
    )

    let home = renderHome()
    await selectEurc()
    await openOperation('12.34')
    fireEvent.click(await screen.findByRole('button', { name: 'confirm' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('actionError')
    expect(passkey.sign).toHaveBeenCalledTimes(1)

    home = reload(home)
    await selectEurc()
    await reopenAndConfirm('12.34')

    await waitFor(() => expect(server.get(op.id).status).toBe('SUBMITTED'))
    expect(passkey.sign).toHaveBeenCalledTimes(1)
    for (const body of submittedBodies(op.id)) expect(body).toEqual(submittedBodies(op.id)[0])
    home.unmount()
})

it('keeps the signed bytes under eurc-signed-operation:<userId>:<operationId> until a final status, then clears them', async () => {
    const op = makeOperation({ amount: '23.45' })
    server.put(op)
    server.handlers.push((request) =>
        request.method === 'POST' && request.path.endsWith('/submit') && submittedBodies(op.id).length === 1
            ? lostResponse()
            : undefined
    )
    // Once the retry lands, the worker settles the operation before the next status read.
    server.handlers.push((request) => {
        if (
            request.method === 'GET' &&
            request.path.endsWith(`/operations/${op.id}`) &&
            submittedBodies(op.id).length > 1
        )
            server.patch(op.id, { status: 'COMPLETED', txHash: `0x${'ef'.repeat(32)}` })
        return undefined
    })

    const home = renderHome()
    await selectEurc()
    await openOperation('23.45')
    fireEvent.click(await screen.findByRole('button', { name: 'confirm' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('actionError')
    expect(localStorage.getItem(recordKey(op.id))).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'confirm' }))
    await waitFor(() => expect(submittedBodies(op.id)).toHaveLength(2))
    expect(await screen.findByRole('heading', { name: 'completed' }, { timeout: 8_000 })).toBeInTheDocument()
    await waitFor(() => expect(localStorage.getItem(recordKey(op.id))).toBeNull())
    expect(passkey.sign).toHaveBeenCalledTimes(1)
    home.unmount()
}, 15_000)

it('switching to USD and back while the passkey prompt is open does not start a second ceremony', async () => {
    const op = makeOperation({ amount: '34.56' })
    server.put(op)
    let finishFirstCeremony!: () => void
    passkey.behaviour = (ceremony: number) =>
        ceremony === 1
            ? new Promise<void>((resolve) => {
                  finishFirstCeremony = resolve
              })
            : Promise.resolve()

    const home = renderHome()
    await selectEurc()
    await openOperation('34.56')
    fireEvent.click(await screen.findByRole('button', { name: 'confirm' }))
    await waitFor(() => expect(passkey.sign).toHaveBeenCalledTimes(1))

    await selectUsdc()
    expect(await screen.findByText('USDC history and card')).toBeInTheDocument()
    await selectEurc()
    await reopenAndConfirm('34.56')
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
    })
    expect(passkey.sign).toHaveBeenCalledTimes(1)

    await act(async () => finishFirstCeremony())
    await waitFor(() => expect(submittedBodies(op.id).length).toBeGreaterThan(0))
    expect(passkey.sign).toHaveBeenCalledTimes(1)
    for (const body of submittedBodies(op.id)) expect(body).toEqual(submittedBodies(op.id)[0])
    home.unmount()
})

it('after operation_expired, re-probes READY with no hash and lets Cancel delete the operation', async () => {
    const op = makeOperation({ kind: 'EXCHANGE', amount: '45.67' })
    server.put(op)
    server.handlers.push((request: FakeRequest) =>
        request.method === 'POST' && request.path.endsWith('/submit')
            ? { status: 409, body: { error: 'operation_expired', code: 'operation_expired' } }
            : undefined
    )

    const home = renderHome()
    await selectEurc()
    await openOperation('45.67')
    fireEvent.click(await screen.findByRole('button', { name: 'confirm' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('expired')

    const cancel = screen.getByRole('button', { name: 'cancel' })
    await waitFor(() => expect(cancel).toBeEnabled())
    fireEvent.click(cancel)

    await waitFor(() => expect(server.calls('DELETE', new RegExp(`/operations/${op.id}$`))).toHaveLength(1))
    expect(server.get(op.id).status).toBe('CANCELLED')
    // Cancel is offered only after the server confirms READY with no hash once more.
    const rejectedAt = server.requests.findIndex(
        (request) => request.method === 'POST' && request.path.endsWith(`/operations/${op.id}/submit`)
    )
    expect(
        server.requests
            .slice(rejectedAt + 1)
            .some((request) => request.method === 'GET' && request.path.endsWith(`/operations/${op.id}`))
    ).toBe(true)
    expect(passkey.sign).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(localStorage.getItem(recordKey(op.id))).toBeNull())
    home.unmount()
})
