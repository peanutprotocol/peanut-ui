const capture = jest.fn()
const captureMessage = jest.fn()

jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: (...args: unknown[]) => capture(...args) },
}))

jest.mock('@sentry/nextjs', () => ({
    addBreadcrumb: jest.fn(),
    captureMessage: (...args: unknown[]) => captureMessage(...args),
}))

jest.mock('@/utils/capacitor', () => ({
    isCapacitor: () => true,
    getPlatform: () => 'ios-native',
}))

import { hashTypedData, keccak256, stringToHex, type Hex } from 'viem'
import { getUserOperationHash, type UserOperation } from 'viem/account-abstraction'
import { withPasskeySignatureCheck } from '@/utils/passkey-signature-check'
import { withCeremonyPurpose } from '@/utils/webauthn-ceremony-telemetry'
import { passkeyFixture, signPasskeyUserOp } from '@/test-utils/passkey-signature'

const { privateKey, publicKey } = passkeyFixture()
const otherPasskey = passkeyFixture(9).privateKey
const entryPoint = { address: '0x0000000071727De22E5E9d8BAf0edAc6f37da032', version: '0.7' } as const
const chainId = 42161

const typedData = {
    domain: {
        name: 'Kernel',
        version: '0.3.1',
        chainId,
        verifyingContract: '0x9b1b687200000000000000000000000000000000',
    },
    types: { Enable: [{ name: 'validationId', type: 'bytes21' }] },
    primaryType: 'Enable',
    message: { validationId: '0x020000000000000000000000000000000000000001' },
} as const

const userOperation = {
    sender: '0x9b1b687200000000000000000000000000000000',
    nonce: 7n,
    callData: '0x',
    callGasLimit: 100_000n,
    verificationGasLimit: 200_000n,
    preVerificationGas: 50_000n,
    maxFeePerGas: 1n,
    maxPriorityFeePerGas: 1n,
    signature: '0xdead',
} as UserOperation<'0.7'>
const userOpHash = getUserOperationHash({
    userOperation: { ...userOperation, signature: '0x' },
    entryPointAddress: entryPoint.address,
    entryPointVersion: '0.7',
    chainId,
})

const message = keccak256(stringToHex('kernel-wrapped hash'))

/** What ZeroDev's validator would return, signed by `signer` over each method's challenge. */
function fakeValidator(signer = privateKey, challenge?: Hex) {
    const sign = (hash: Hex) => signPasskeyUserOp({ userOpHash: challenge ?? hash, privateKey: signer })
    return {
        address: '0x7ab16Ff354AcB328452F1D445b3Ddee9a91e9e69',
        getIdentifier: () => '0x7ab16Ff354AcB328452F1D445b3Ddee9a91e9e69',
        signMessage: jest.fn(async ({ message: m }: { message: { raw: Hex } }) => sign(m.raw)),
        signTypedData: jest.fn(async () => sign(hashTypedData(typedData))),
        signUserOperation: jest.fn(async () => sign(userOpHash)),
    }
}

const wrap = (validator: ReturnType<typeof fakeValidator>, opts: { chainId?: number } = { chainId }) =>
    withPasskeySignatureCheck(validator as never, { publicKey, chainId: opts.chainId, entryPoint })

beforeEach(() => {
    capture.mockReset()
    captureMessage.mockReset()
})

describe('withPasskeySignatureCheck (log-only)', () => {
    it('returns a valid signature unchanged and reports nothing, for every signing method', async () => {
        const validator = fakeValidator()
        const checked = wrap(validator)

        expect(await checked.signMessage({ message: { raw: message } })).toBe(
            await validator.signMessage.mock.results[0].value
        )
        await checked.signTypedData(typedData as never)
        await checked.signUserOperation(userOperation)

        expect(validator.signUserOperation).toHaveBeenCalledWith(userOperation, undefined)
        expect(capture).not.toHaveBeenCalled()
        expect(captureMessage).not.toHaveBeenCalled()
    })

    it('keeps the validator identity the kernel reads', () => {
        const checked = wrap(fakeValidator())
        expect(checked.address).toBe('0x7ab16Ff354AcB328452F1D445b3Ddee9a91e9e69')
        expect(checked.getIdentifier()).toBe('0x7ab16Ff354AcB328452F1D445b3Ddee9a91e9e69')
    })

    it('reports a signature by another passkey and still returns it', async () => {
        const validator = fakeValidator(otherPasskey)
        const checked = wrap(validator)

        const signature = await withCeremonyPurpose('session_key_grant', () =>
            checked.signTypedData(typedData as never)
        )

        expect(signature).toBe(await validator.signTypedData.mock.results[0].value)
        expect(capture).toHaveBeenCalledTimes(1)
        expect(capture).toHaveBeenCalledWith('passkey_signature_mismatch', {
            method: 'signTypedData',
            reason: 'signature',
            platform: 'ios-native',
            purpose: 'session_key_grant',
            challenge_offset: 23,
        })
        expect(captureMessage).toHaveBeenCalledWith(
            'Passkey signature fails the on-chain validator check',
            expect.objectContaining({
                level: 'warning',
                tags: {
                    method: 'signTypedData',
                    reason: 'signature',
                    platform: 'ios-native',
                    purpose: 'session_key_grant',
                },
            })
        )
    })

    it('reports a signature over another challenge', async () => {
        const checked = wrap(fakeValidator(privateKey, keccak256(stringToHex('another operation'))))

        await checked.signMessage({ message: { raw: message } })

        expect(capture).toHaveBeenCalledWith(
            'passkey_signature_mismatch',
            expect.objectContaining({ method: 'signMessage', reason: 'challenge' })
        )
    })

    it('reports a failing check as check_error and still returns the signature', async () => {
        const validator = fakeValidator()
        const checked = wrap(validator, { chainId: undefined })

        const signature = await checked.signUserOperation(userOperation)

        expect(signature).toBe(await validator.signUserOperation.mock.results[0].value)
        expect(capture).toHaveBeenCalledWith(
            'passkey_signature_mismatch',
            expect.objectContaining({ method: 'signUserOperation', reason: 'check_error' })
        )
    })

    it('still returns the signature when reporting itself fails', async () => {
        capture.mockImplementation(() => {
            throw new Error('posthog not ready')
        })
        const validator = fakeValidator(otherPasskey)
        const checked = wrap(validator)

        await expect(checked.signMessage({ message: { raw: message } })).resolves.toBe(
            await validator.signMessage.mock.results[0].value
        )
    })

    it('passes a failed ceremony through untouched, without a report', async () => {
        const validator = fakeValidator()
        validator.signMessage.mockRejectedValueOnce(new Error('NotAllowedError'))
        const checked = wrap(validator)

        await expect(checked.signMessage({ message: { raw: message } })).rejects.toThrow('NotAllowedError')
        expect(capture).not.toHaveBeenCalled()
    })
})
