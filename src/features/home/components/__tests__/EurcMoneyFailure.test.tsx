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
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => null }))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/components/Global/QRCodeWrapper', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/CurrencyBalanceNotice', () => ({ CurrencyBalanceNotice: () => null }))
jest.mock('../EurcBankAccountView', () => ({ EurcBankAccountView: () => null }))
jest.mock('../../views/BalanceSection', () => ({ BalanceSection: () => <div>Balance</div> }))

beforeEach(() => {
    mockUserId = 'alice'
    server.reset()
    passkey.sign.mockClear()
    passkey.behaviour = undefined
    localStorage.clear()
})
afterEach(() => jest.restoreAllMocks())

it('submits from memory when device storage throws, without a second signature', async () => {
    const op = makeOperation({ amount: '12.34' })
    server.put(op)
    const home = renderHome()
    await selectEurc()
    await openOperation('12.34')
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('private mode')
    })
    fireEvent.click(await screen.findByRole('button', { name: 'confirm' }))
    await waitFor(() => expect(submittedBodies(op.id)).toHaveLength(1))
    expect(passkey.sign).toHaveBeenCalledTimes(1)
    expect(submittedBodies(op.id)[0]).toEqual(
        expect.objectContaining({ operation: expect.objectContaining({ signature: signatureFor(1) }) })
    )
    home.unmount()
})

it('an account switch during signing cannot persist or submit the old user’s bytes', async () => {
    const op = makeOperation({ amount: '23.45' })
    server.put(op)
    let finish!: () => void
    passkey.behaviour = () =>
        new Promise<void>((resolve) => {
            finish = resolve
        })
    const home = renderHome()
    await selectEurc()
    await openOperation('23.45')
    fireEvent.click(await screen.findByRole('button', { name: 'confirm' }))
    await waitFor(() => expect(passkey.sign).toHaveBeenCalledTimes(1))
    mockUserId = 'bob'
    server.user = 'bob'
    home.rerenderHome()
    await act(async () => {
        finish()
        await new Promise((resolve) => setTimeout(resolve, 50))
    })
    expect(submittedBodies(op.id)).toHaveLength(0)
    expect(localStorage.getItem(`eurc-signed-operation:alice:${op.id}`)).toBeNull()
    expect(screen.queryByText(/23\.45/)).not.toBeInTheDocument()
    home.unmount()
})

it('an expired rejection followed by a lost probe keeps signed bytes and Cancel disabled', async () => {
    const op = makeOperation({ amount: '34.56' })
    server.put(op)
    server.handlers.push((request) => {
        if (request.method === 'POST' && request.path.endsWith('/submit'))
            return { status: 409, body: { code: 'operation_expired' } }
        if (request.method === 'GET' && request.path.endsWith(`/operations/${op.id}`) && submittedBodies(op.id).length)
            return lostResponse()
        return undefined
    })
    const home = renderHome()
    await selectEurc()
    await openOperation('34.56')
    fireEvent.click(await screen.findByRole('button', { name: 'confirm' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('actionError'))
    expect(screen.getByRole('button', { name: 'cancel' })).toBeDisabled()
    expect(localStorage.getItem(`eurc-signed-operation:alice:${op.id}`)).not.toBeNull()
    expect(server.calls('DELETE', /\/operations\//)).toHaveLength(0)
    home.unmount()
})
