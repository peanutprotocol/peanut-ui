/**
 * Tests for the native WebAuthn bridge — the most security-critical native
 * file: DER signature parsing/normalization, SPKI public-key extraction, and
 * the multi-account credential pinning that prevents the OS from handing back
 * a different account's passkey (on-chain signature rejection).
 */
import { p256 } from '@noble/curves/p256'
import { decodeAbiParameters, keccak256, type Hex } from 'viem'

import { webcrypto } from 'node:crypto'

import { base64URLToBytes, createNativeSignMessageCallback, parsePublicKeyToWebAuthnKey } from '../native-webauthn'

// jsdom has no WebCrypto; parsePublicKeyToWebAuthnKey needs crypto.subtle
if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
}

const P256_N = p256.CURVE.n

function bytesToBase64URL(bytes: Uint8Array): string {
    let str = ''
    for (const byte of bytes) str += String.fromCharCode(byte)
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function hexToBytes(hex: string): Uint8Array {
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex
    return new Uint8Array(clean.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)))
}

describe('base64URLToBytes', () => {
    it('decodes URL-safe alphabet and restores stripped padding', () => {
        // 0xfb 0xef 0xff encodes to '++//' in base64 → '--__' in base64url
        expect(Array.from(base64URLToBytes('--__'))).toEqual([0xfb, 0xef, 0xff])
        // 'ab' → 'YWI=' in base64; base64url strips the '='
        expect(Array.from(base64URLToBytes('YWI'))).toEqual([0x61, 0x62])
    })

    it('round-trips arbitrary bytes', () => {
        const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255])
        expect(Array.from(base64URLToBytes(bytesToBase64URL(bytes)))).toEqual(Array.from(bytes))
    })
})

describe('parsePublicKeyToWebAuthnKey', () => {
    it('extracts the P-256 coordinates from an SPKI key and hashes the authenticator id', async () => {
        const keyPair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
            'sign',
            'verify',
        ])) as CryptoKeyPair

        const spki = new Uint8Array(await crypto.subtle.exportKey('spki', keyPair.publicKey))
        const raw = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey))

        const authenticatorId = bytesToBase64URL(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))
        const key = await parsePublicKeyToWebAuthnKey(bytesToBase64URL(spki), authenticatorId, 'peanut.me')

        // raw = 0x04 || X (32 bytes) || Y (32 bytes)
        const expectedX = BigInt(`0x${Buffer.from(raw.slice(1, 33)).toString('hex')}`)
        const expectedY = BigInt(`0x${Buffer.from(raw.slice(33, 65)).toString('hex')}`)
        expect(key.pubX).toBe(expectedX)
        expect(key.pubY).toBe(expectedY)
        expect(key.rpID).toBe('peanut.me')
        expect(key.authenticatorId).toBe(authenticatorId)
        expect(key.authenticatorIdHash).toBe(keccak256('0x0102030405060708'))
    })
})

describe('createNativeSignMessageCallback', () => {
    const RP_ID = 'peanut.me'
    const MESSAGE = '0xdeadbeef' as Hex

    // fixed, in-range signature components (parse-only path — no verification)
    const SIG_R = BigInt('0x5c7d34a9f6dd6dd2c9dd5b5f6dbb1e0e63e1cfeb2c7de4b7a54d0f0a0d1c2b3a')
    const SIG_S_LOW = 0x1234n

    const clientDataJSON = JSON.stringify({ type: 'webauthn.get', challenge: 'x', origin: 'https://peanut.me' })
    const authenticatorData = new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd])

    function mockAssertion(sig: { r: bigint; s: bigint }) {
        const der = hexToBytes(new p256.Signature(sig.r, sig.s).toDERHex())
        return {
            response: {
                authenticatorData: authenticatorData.buffer,
                clientDataJSON: new TextEncoder().encode(clientDataJSON).buffer,
                signature: der.buffer,
            },
        }
    }

    let credentialsGet: jest.Mock

    function installCredentialsMock(assertion: unknown) {
        credentialsGet = jest.fn().mockResolvedValue(assertion)
        Object.defineProperty(global.navigator, 'credentials', {
            value: { get: credentialsGet },
            configurable: true,
        })
    }

    function decodeResult(result: Hex) {
        const [authData, clientData, responseTypeLocation, r, s, usePrecompiled] = decodeAbiParameters(
            [
                { name: 'authenticatorData', type: 'bytes' },
                { name: 'clientDataJSON', type: 'string' },
                { name: 'responseTypeLocation', type: 'uint256' },
                { name: 'r', type: 'uint256' },
                { name: 's', type: 'uint256' },
                { name: 'usePrecompiled', type: 'bool' },
            ],
            result
        )
        return { authData, clientData, responseTypeLocation, r, s, usePrecompiled }
    }

    it('parses a DER signature and encodes the zerodev response tuple', async () => {
        installCredentialsMock(mockAssertion({ r: SIG_R, s: SIG_S_LOW }))
        const sign = createNativeSignMessageCallback(RP_ID)

        const decoded = decodeResult(await sign(MESSAGE, RP_ID, 8453))

        expect(decoded.r).toBe(SIG_R)
        expect(decoded.s).toBe(SIG_S_LOW)
        expect(decoded.authData).toBe('0xaabbccdd')
        expect(decoded.clientData).toBe(clientDataJSON)
        expect(decoded.responseTypeLocation).toBe(BigInt(clientDataJSON.lastIndexOf('"type":"webauthn.get"')))
        expect(decoded.usePrecompiled).toBe(true)
    })

    it('normalizes a high-S (malleable) signature to low-S', async () => {
        const highS = P256_N - SIG_S_LOW
        installCredentialsMock(mockAssertion({ r: SIG_R, s: highS }))
        const sign = createNativeSignMessageCallback(RP_ID)

        const decoded = decodeResult(await sign(MESSAGE, RP_ID, 8453))

        expect(decoded.s).toBe(SIG_S_LOW)
        expect(decoded.s <= P256_N / 2n).toBe(true)
    })

    it('flags usePrecompiled only on RIP-7212 chains', async () => {
        const sign = createNativeSignMessageCallback(RP_ID)
        for (const [chainId, expected] of [
            [137, true],
            [8453, true],
            [10, true],
            [42161, true],
            [1, false],
        ] as const) {
            installCredentialsMock(mockAssertion({ r: SIG_R, s: SIG_S_LOW }))
            const decoded = decodeResult(await sign(MESSAGE, RP_ID, chainId))
            expect(decoded.usePrecompiled).toBe(expected)
        }
    })

    it('passes the message bytes as the challenge and the configured rpId', async () => {
        installCredentialsMock(mockAssertion({ r: SIG_R, s: SIG_S_LOW }))
        const sign = createNativeSignMessageCallback(RP_ID)
        await sign(MESSAGE, 'ignored-rp-id-from-caller', 8453)

        const options = credentialsGet.mock.calls[0][0].publicKey
        expect(Array.from(new Uint8Array(options.challenge))).toEqual([0xde, 0xad, 0xbe, 0xef])
        expect(options.rpId).toBe(RP_ID)
        expect(options.userVerification).toBe('required')
    })

    it('accepts string, {raw: hex} and {raw: Uint8Array} messages; rejects others', async () => {
        const sign = createNativeSignMessageCallback(RP_ID)
        for (const message of [MESSAGE, { raw: MESSAGE }, { raw: new Uint8Array([0xde, 0xad, 0xbe, 0xef]) }]) {
            installCredentialsMock(mockAssertion({ r: SIG_R, s: SIG_S_LOW }))
            await sign(message as Parameters<typeof sign>[0], RP_ID, 8453)
            const options = credentialsGet.mock.calls[0][0].publicKey
            expect(Array.from(new Uint8Array(options.challenge))).toEqual([0xde, 0xad, 0xbe, 0xef])
        }

        await expect(sign({ raw: 42 } as unknown as Parameters<typeof sign>[0], RP_ID, 8453)).rejects.toThrow(
            'unsupported message format'
        )
    })

    it('throws when no credential comes back', async () => {
        installCredentialsMock(null)
        const sign = createNativeSignMessageCallback(RP_ID)
        await expect(sign(MESSAGE, RP_ID, 8453)).rejects.toThrow('native signing failed')
    })

    describe('credential pinning (multi-account fix)', () => {
        const PINNED_ID_BYTES = new Uint8Array([9, 9, 9, 9])
        const PINNED_ID = bytesToBase64URL(PINNED_ID_BYTES)

        it('pins the assertion to the kernel own credential when no allow-list is supplied', async () => {
            installCredentialsMock(mockAssertion({ r: SIG_R, s: SIG_S_LOW }))
            const sign = createNativeSignMessageCallback(RP_ID, PINNED_ID)
            await sign(MESSAGE, RP_ID, 8453)

            const allow = credentialsGet.mock.calls[0][0].publicKey.allowCredentials
            expect(allow).toHaveLength(1)
            expect(allow[0].type).toBe('public-key')
            expect(Array.from(new Uint8Array(allow[0].id))).toEqual(Array.from(PINNED_ID_BYTES))
        })

        it('never overrides a caller-supplied allow-list', async () => {
            const callerIdBytes = new Uint8Array([7, 7])
            installCredentialsMock(mockAssertion({ r: SIG_R, s: SIG_S_LOW }))
            const sign = createNativeSignMessageCallback(RP_ID, PINNED_ID)
            await sign(MESSAGE, RP_ID, 8453, [{ id: bytesToBase64URL(callerIdBytes), type: 'public-key' }])

            const allow = credentialsGet.mock.calls[0][0].publicKey.allowCredentials
            expect(allow).toHaveLength(1)
            expect(Array.from(new Uint8Array(allow[0].id))).toEqual(Array.from(callerIdBytes))
        })

        it('treats an empty caller allow-list as absent and falls back to the pin', async () => {
            installCredentialsMock(mockAssertion({ r: SIG_R, s: SIG_S_LOW }))
            const sign = createNativeSignMessageCallback(RP_ID, PINNED_ID)
            await sign(MESSAGE, RP_ID, 8453, [])

            const allow = credentialsGet.mock.calls[0][0].publicKey.allowCredentials
            expect(allow).toHaveLength(1)
            expect(Array.from(new Uint8Array(allow[0].id))).toEqual(Array.from(PINNED_ID_BYTES))
        })

        it('leaves allowCredentials undefined with no pin and no allow-list (legacy behaviour)', async () => {
            installCredentialsMock(mockAssertion({ r: SIG_R, s: SIG_S_LOW }))
            const sign = createNativeSignMessageCallback(RP_ID)
            await sign(MESSAGE, RP_ID, 8453)

            expect(credentialsGet.mock.calls[0][0].publicKey.allowCredentials).toBeUndefined()
        })
    })
})
