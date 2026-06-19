import { decodeRecoveryKey, encodeRecoveryKey, toRescueWebAuthnKey, type RecoveryKeyInput } from '../walletRescue.utils'

// Synthetic fixture — not a real user. authenticatorIdHash + blob were computed
// independently with `keccak256(b64ToBytes(credId))` and base64url(JSON).
const CRED_ID = 'dGVzdC1jcmVkZW50aWFsLWlk'
const FIXTURE: RecoveryKeyInput = {
    pubX: '0x2b100abd8d5d282665c2169975b8a858dacf5129fb6e696c80b1e56d7f4175db',
    pubY: '0x3ce7cc7b15895297c56dc8be3b10b9070b20d2d33e985f452d5563fa57d069c2',
    credId: CRED_ID,
    address: '0x7389Ee339bb870c586FDe8e980eDf0B75F5ffb7C',
}
const EXPECTED_AUTH_ID_HASH = '0x35284358f5f974f25625bab32d0848696dec20d51a3197ed478f891a20fbc569'
const BLOB =
    'eyJwdWJYIjoiMHgyYjEwMGFiZDhkNWQyODI2NjVjMjE2OTk3NWI4YTg1OGRhY2Y1MTI5ZmI2ZTY5NmM4MGIxZTU2ZDdmNDE3NWRiIiwicHViWSI6IjB4M2NlN2NjN2IxNTg5NTI5N2M1NmRjOGJlM2IxMGI5MDcwYjIwZDJkMzNlOTg1ZjQ1MmQ1NTYzZmE1N2QwNjljMiIsImNyZWRJZCI6ImRHVnpkQzFqY21Wa1pXNTBhV0ZzTFdsayIsImFkZHJlc3MiOiIweDczODlFZTMzOWJiODcwYzU4NkZEZThlOTgwZURmMEI3NUY1ZmZiN0MifQ'

describe('toRescueWebAuthnKey', () => {
    it('rebuilds the WebAuthnKey from persisted passkey material', () => {
        const key = toRescueWebAuthnKey(FIXTURE)
        expect(key.pubX).toBe(BigInt(FIXTURE.pubX))
        expect(key.pubY).toBe(BigInt(FIXTURE.pubY))
        expect(key.authenticatorId).toBe(CRED_ID)
        expect(key.authenticatorIdHash).toBe(EXPECTED_AUTH_ID_HASH)
        expect(key.rpID).toBe('')
    })

    it('accepts coords without a 0x prefix', () => {
        const key = toRescueWebAuthnKey({ ...FIXTURE, pubX: FIXTURE.pubX.slice(2), pubY: FIXTURE.pubY.slice(2) })
        expect(key.pubX).toBe(BigInt(FIXTURE.pubX))
        expect(key.pubY).toBe(BigInt(FIXTURE.pubY))
    })
})

describe('decodeRecoveryKey', () => {
    it('decodes a valid base64url blob', () => {
        expect(decodeRecoveryKey(BLOB)).toEqual(FIXTURE)
    })

    it('round-trips through encodeRecoveryKey', () => {
        const withExtras: RecoveryKeyInput = {
            ...FIXTURE,
            to: '0xA63C78bAd9aF4bECb75D5AEA1Ba02DD1ab55839b',
            label: 'Test',
        }
        expect(decodeRecoveryKey(encodeRecoveryKey(withExtras))).toEqual(withExtras)
    })

    it('rejects a malformed blob', () => {
        expect(() => decodeRecoveryKey('not-valid-json')).toThrow('malformed')
    })

    it('rejects an invalid wallet address', () => {
        expect(() => decodeRecoveryKey(encodeRecoveryKey({ ...FIXTURE, address: '0x123' as `0x${string}` }))).toThrow(
            'invalid wallet address'
        )
    })

    it('rejects an invalid public key', () => {
        expect(() => decodeRecoveryKey(encodeRecoveryKey({ ...FIXTURE, pubX: 'zzzz' }))).toThrow('invalid public key')
    })
})
