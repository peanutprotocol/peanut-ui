/**
 * The lock's safety property is asymmetric: failing to lock is a security
 * weakness, but failing to UNLOCK strands the user in their own app with no
 * way out. These tests pin which failure modes fall which way.
 */
import { webcrypto } from 'node:crypto'

import { requestLocalUserPresence } from '../app-lock'
import { base64URLToBytes } from '../native-webauthn'

if (!globalThis.crypto?.getRandomValues) {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
}

const CREDENTIAL_ID = 'YWJjZGVmZ2g'

function withCredentialsGet(impl: () => Promise<Credential | null>) {
    Object.defineProperty(globalThis, 'PublicKeyCredential', { value: function () {}, configurable: true })
    Object.defineProperty(globalThis.navigator, 'credentials', {
        value: { get: impl },
        configurable: true,
    })
}

describe('requestLocalUserPresence', () => {
    it('reports unsupported when there is no stored credential to prompt against', async () => {
        withCredentialsGet(async () => ({}) as Credential)
        await expect(requestLocalUserPresence(undefined)).resolves.toBe('unsupported')
    })

    it('reports unsupported when the platform has no WebAuthn', async () => {
        Object.defineProperty(globalThis, 'PublicKeyCredential', { value: undefined, configurable: true })
        await expect(requestLocalUserPresence(CREDENTIAL_ID)).resolves.toBe('unsupported')
    })

    it('unlocks when the authenticator returns an assertion', async () => {
        withCredentialsGet(async () => ({}) as Credential)
        await expect(requestLocalUserPresence(CREDENTIAL_ID)).resolves.toBe('unlocked')
    })

    it('stays locked when the user cancels the prompt', async () => {
        withCredentialsGet(async () => {
            throw Object.assign(new Error('cancelled'), { name: 'NotAllowedError' })
        })
        await expect(requestLocalUserPresence(CREDENTIAL_ID)).resolves.toBe('dismissed')
    })

    it('reports unsupported when the authenticator rejects the request outright', async () => {
        withCredentialsGet(async () => {
            throw Object.assign(new Error('nope'), { name: 'NotSupportedError' })
        })
        await expect(requestLocalUserPresence(CREDENTIAL_ID)).resolves.toBe('unsupported')
    })

    it('pins the request to the stored credential and demands user verification', async () => {
        let received: PublicKeyCredentialRequestOptions | undefined
        withCredentialsGet(async (options?: CredentialRequestOptions) => {
            received = options?.publicKey
            return {} as Credential
        })
        await requestLocalUserPresence(CREDENTIAL_ID)
        expect(received?.userVerification).toBe('required')
        expect(received?.allowCredentials).toHaveLength(1)
        // Assert the actual bytes, not just the count: a descriptor for the
        // WRONG credential would satisfy a length check while letting some
        // other passkey on the device open the lock.
        expect(Array.from(new Uint8Array(received!.allowCredentials![0].id as ArrayBuffer))).toEqual(
            Array.from(base64URLToBytes(CREDENTIAL_ID))
        )
        expect(new Uint8Array(received!.challenge as ArrayBuffer)).not.toHaveLength(0)
    })
})
