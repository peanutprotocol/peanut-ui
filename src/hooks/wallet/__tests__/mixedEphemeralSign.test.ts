import { signMixedEphemeralSpend, SIGN_ONLY_TTL_SECONDS } from '../mixedEphemeralSign'
import { createEphemeralSpendSession } from '@/utils/ephemeralSpendKey'
import { signUserOperation } from '@zerodev/sdk/actions'

jest.mock('@/utils/ephemeralSpendKey', () => ({ createEphemeralSpendSession: jest.fn() }))
jest.mock('@zerodev/sdk/actions', () => ({ signUserOperation: jest.fn() }))
jest.mock('@/utils/rainWithdraw.utils', () => ({ buildRainWithdrawTypedData: jest.fn(() => ({ typed: true })) }))
jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_TOKEN: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    USER_OP_ENTRY_POINT: { address: '0x0000000071727De22E5E9d8BAf0edAc6f37da032' },
}))

const mockCreateSession = createEphemeralSpendSession as jest.Mock
const mockSignUserOperation = signUserOperation as jest.Mock

const PREP = {
    preparationId: 'prep-1',
    coordinatorAddress: '0xc0d5bd6307ec8c8da03e7502a00b8cba24eefc06',
    collateralProxy: '0x1111111111111111111111111111111111111111',
    tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    amount: '150000000',
    recipientAddress: '0x2222222222222222222222222222222222222222',
    directTransfer: false,
    adminSalt: '0x3333333333333333333333333333333333333333333333333333333333333333',
    executorSignature: '0x44',
    executorSalt: '0x5555555555555555555555555555555555555555555555555555555555555555',
    expiresAt: 1234567890,
}

function baseArgs() {
    return {
        publicClient: {} as never,
        chain: { id: 42161 } as never,
        patchedSudoValidator: {} as never,
        accountAddress: '0x9999999999999999999999999999999999999999' as const,
        prep: PREP as never,
        recipient: '0x2222222222222222222222222222222222222222' as const,
        requiredUsdcAmount: 200_000_000n,
    }
}

function fakeSession() {
    const dispose = jest.fn()
    const encodeCalls = jest.fn(async (_calls: unknown[]) => '0xcalldata')
    const session = {
        account: { signTypedData: jest.fn(async () => '0xephemeraladminsig'), encodeCalls },
        client: { tag: 'session-client' },
        uninstallCall: { to: '0x9999999999999999999999999999999999999999', value: 0n, data: '0xuninstall' },
        dispose,
    }
    mockCreateSession.mockResolvedValue(session)
    return { session, dispose, encodeCalls }
}

beforeEach(() => {
    jest.clearAllMocks()
    mockSignUserOperation.mockResolvedValue({ sender: '0x99', nonce: 1n, signature: '0xsig' })
})

describe('signMixedEphemeralSpend', () => {
    it('signs admin EIP-712 and the UserOp with the ephemeral key, uninstall last, and returns an unbroadcast artifact', async () => {
        const { session, dispose, encodeCalls } = fakeSession()

        const result = await signMixedEphemeralSpend(baseArgs())

        expect(result).toEqual({
            ok: true,
            signedUserOp: {
                signedUserOp: { sender: '0x99', nonce: 1n, signature: '0xsig' },
                chainId: '42161',
                entryPointAddress: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
            },
        })
        // the permission lives long enough for a backend broadcast
        expect(mockCreateSession.mock.calls[0][0].ttlSeconds).toBe(SIGN_ONLY_TTL_SECONDS)
        // silent admin signature from the session key, not a passkey
        expect(session.account.signTypedData).toHaveBeenCalledWith({ typed: true })
        // withdraw, transfer, then the self-destruct as the LAST call
        const calls = encodeCalls.mock.calls[0][0] as Array<{ to: string; data: string }>
        expect(calls).toHaveLength(3)
        expect(calls[0].to).toBe(PREP.coordinatorAddress)
        expect(calls[2]).toBe(session.uninstallCall)
        // signed through the session client, never sent
        expect(mockSignUserOperation).toHaveBeenCalledWith(session.client, {
            account: session.account,
            callData: '0xcalldata',
        })
        expect(dispose).toHaveBeenCalledTimes(1)
    })

    it('reports a preflight failure as ok:false and still disposes nothing was created', async () => {
        mockCreateSession.mockRejectedValue(new Error('ephemeral key: validator nonce floored'))
        const result = await signMixedEphemeralSpend(baseArgs())
        expect(result).toEqual({ ok: false, reason: 'ephemeral key: validator nonce floored' })
        expect(mockSignUserOperation).not.toHaveBeenCalled()
    })

    it('reports a signing failure as ok:false and disposes the key', async () => {
        const { dispose } = fakeSession()
        mockSignUserOperation.mockRejectedValue(new Error('bundler estimate failed'))
        const result = await signMixedEphemeralSpend(baseArgs())
        expect(result).toEqual({ ok: false, reason: 'bundler estimate failed' })
        expect(dispose).toHaveBeenCalledTimes(1)
    })
})
