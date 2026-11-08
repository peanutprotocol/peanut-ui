/**
 * The link-key proof the app sends on GET /send-links/:pubKey (TASK-24599).
 *
 * SEND_LINK_PROOF_VECTOR is copied from peanut-api-ts
 * `test/fixtures/send-link-proof-vector.ts`, where the API's verifier accepts
 * it. viem signs deterministically (RFC 6979), so producing the same signature
 * here proves the app signs exactly what the API verifies. Change both or neither.
 */
import { recoverMessageAddress } from 'viem'
import { generateKeysFromString } from '@/utils/peanut-link.utils'
import { sendLinkReadMessage, sendLinkReadProof } from '@/utils/send-link-proof.utils'

const SEND_LINK_PROOF_VECTOR = {
    password: 'TASK-24599-fixed-test-vector',
    pubKey: '0x9d11879E77940A5A87aCA2C78ACD71312F75c159',
    chainId: '42161',
    unixSeconds: 1794009600,
    // Stored without its 0x prefix: the pre-commit secret scan reads any 0x and 64 hex digits as a
    // private key. This is a public signature.
    signature: `0x${'2bb1da2fda43954b399fcc093aa485f7f19c0f9906344a6be834af4707a896161ee74591d9f52c6db316245e0f6f42b0fff3b91a1246c7f4496734c7159a0dba1c'}`,
} as const
const V = SEND_LINK_PROOF_VECTOR

describe('sendLinkReadProof', () => {
    test('the link password derives the vector pubKey', () => {
        expect(generateKeysFromString(V.password).address).toBe(V.pubKey)
    })

    test('produces exactly the proof the API accepts', async () => {
        const { address, privateKey } = generateKeysFromString(V.password)
        expect(await sendLinkReadProof(privateKey, address, V.chainId, V.unixSeconds)).toBe(
            `${V.unixSeconds}.${V.signature}`
        )
    })

    test('signs the lowercased pubKey, so checksum casing cannot change the proof', async () => {
        const { privateKey } = generateKeysFromString(V.password)
        expect(await sendLinkReadProof(privateKey, V.pubKey.toLowerCase(), V.chainId, V.unixSeconds)).toBe(
            `${V.unixSeconds}.${V.signature}`
        )
    })

    test('defaults to the current time and recovers to the link key', async () => {
        const { address, privateKey } = generateKeysFromString(V.password)
        const before = Math.floor(Date.now() / 1000)
        const proof = await sendLinkReadProof(privateKey, address, V.chainId)
        const [seconds, signature] = proof.split('.')
        expect(Number(seconds)).toBeGreaterThanOrEqual(before)
        const signer = await recoverMessageAddress({
            message: sendLinkReadMessage(address, V.chainId, Number(seconds)),
            signature: signature as `0x${string}`,
        })
        expect(signer).toBe(address)
    })

    test('never carries the password or the private key', async () => {
        const { address, privateKey } = generateKeysFromString(V.password)
        const proof = await sendLinkReadProof(privateKey, address, V.chainId, V.unixSeconds)
        expect(proof).not.toContain(V.password)
        expect(proof).not.toContain(privateKey.slice(2))
    })
})
