/**
 * TASK-21815 review — the REAL tryMixedEphemeralSpend must fire
 * onBroadcastAttempt at the transport boundary and nowhere earlier: encode,
 * preparation, and signature failures leave the marker untouched; a
 * transport rejection observes it exactly once, fired before the send.
 */
import { tryMixedEphemeralSpend } from '../mixedEphemeralSpend'
import { createEphemeralSpendSession } from '@/utils/ephemeralSpendKey'

jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_TOKEN: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
}))
jest.mock('@/utils/rainWithdraw.utils', () => ({ buildRainWithdrawTypedData: jest.fn(() => ({})) }))
jest.mock('@/utils/ephemeralSpendKey', () => ({ createEphemeralSpendSession: jest.fn() }))
jest.mock('@/utils/userop-rescue.utils', () => ({ rescueUserOpReceipt: jest.fn(async () => null) }))

const mockCreateSession = createEphemeralSpendSession as jest.Mock

const PREP = {
    preparationId: 'prep-1',
    coordinatorAddress: '0xc0d5bd6307ec8c8da03e7502a00b8cba24eefc06',
    collateralProxy: '0x1111111111111111111111111111111111111111',
    adminAddress: '0xc97fffbf8768ca90cd62fae2e313b084fe13e553',
    chainId: '42161',
    tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    amount: '150000000',
    recipientAddress: '0x4e5b89fd498f333ed7f2a59c5f23d5b5dc41b3de',
    directTransfer: false,
    adminSalt: `0x${'a'.repeat(64)}`,
    adminNonce: '1',
    executorSignature: `0x${'b'.repeat(130)}`,
    executorSalt: `0x${'c'.repeat(64)}`,
    expiresAt: 1234567890,
}

function makeSession(overrides: { encodeCalls?: jest.Mock; prepare?: jest.Mock; sign?: jest.Mock; send?: jest.Mock }) {
    const encodeCalls = overrides.encodeCalls ?? jest.fn(async () => '0xencoded')
    const prepare = overrides.prepare ?? jest.fn(async () => ({ callData: '0xencoded', callGasLimit: 1n }))
    const sign = overrides.sign ?? jest.fn(async () => `0x${'e'.repeat(130)}`)
    const send = overrides.send ?? jest.fn(async () => ('0x' + 'f'.repeat(64)) as `0x${string}`)
    return {
        account: {
            address: '0xc97fffbf8768ca90cd62fae2e313b084fe13e553',
            signTypedData: jest.fn(async () => `0x${'d'.repeat(130)}`),
            encodeCalls,
            signUserOperation: sign,
        },
        client: {
            prepareUserOperation: prepare,
            sendUserOperation: send,
            waitForUserOperationReceipt: jest.fn(async () => ({ success: true, receipt: { status: 'success' } })),
        },
        uninstallCall: { to: '0x0000000000000000000000000000000000000001', value: 0n, data: '0x' },
        dispose: jest.fn(),
    }
}

function args(session: ReturnType<typeof makeSession>, onBroadcastAttempt: jest.Mock) {
    mockCreateSession.mockResolvedValueOnce(session)
    return {
        publicClient: {} as never,
        chain: { id: 42161 } as never,
        patchedSudoValidator: {} as never,
        accountAddress: '0xc97fffbf8768ca90cd62fae2e313b084fe13e553' as `0x${string}`,
        prep: PREP as never,
        requiredUsdcAmount: 150_000_000n,
        subsequentCalls: [],
        onBroadcastAttempt,
    }
}

describe('tryMixedEphemeralSpend — real broadcast boundary', () => {
    it.each([
        [
            'encode',
            {
                encodeCalls: jest.fn(async () => {
                    throw new Error('encode boom')
                }),
            },
        ],
        [
            'prepare',
            {
                prepare: jest.fn(async () => {
                    throw new Error('prepare boom')
                }),
            },
        ],
        [
            'sign',
            {
                sign: jest.fn(async () => {
                    throw new Error('sign boom')
                }),
            },
        ],
    ] as const)('a %s failure never fires the marker', async (_stage, overrides) => {
        const marker = jest.fn()
        const result = await tryMixedEphemeralSpend(args(makeSession(overrides), marker))
        expect(result.ok).toBe(false)
        expect(marker).not.toHaveBeenCalled()
    })

    it('a transport rejection observes the marker exactly once, fired before the send', async () => {
        const marker = jest.fn()
        const send = jest.fn(async () => {
            expect(marker).toHaveBeenCalledTimes(1)
            throw new Error('bundler down')
        })
        const result = await tryMixedEphemeralSpend(args(makeSession({ send }), marker))
        expect(result.ok).toBe(false)
        expect(send).toHaveBeenCalledTimes(1)
        expect(marker).toHaveBeenCalledTimes(1)
    })
})
