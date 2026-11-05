import { keccak256, stringToHex } from 'viem'
import { checkPasskeyUserOpSignature, VALIDATOR_CHALLENGE_LOCATION } from '../webauthn-userop-signature'
import { passkeyFixture, signPasskeyUserOp, sortedClientData, standardClientData } from '@/test-utils/passkey-signature'

const userOpHash = keccak256(stringToHex('signup test transaction'))
const { privateKey, publicKey } = passkeyFixture()

describe('checkPasskeyUserOpSignature (deployed validator v0.0.3 rules)', () => {
    it('accepts the standard layout: challenge at byte 23, valid low-s signature', () => {
        const signature = signPasskeyUserOp({ userOpHash, privateKey })
        expect(checkPasskeyUserOpSignature({ signature, userOpHash, publicKey })).toEqual({
            valid: true,
            challengeOffset: VALIDATOR_CHALLENGE_LOCATION,
        })
    })

    it('accepts an origin and extra fields after the challenge', () => {
        const signature = signPasskeyUserOp({
            userOpHash,
            privateKey,
            clientData: (challenge) =>
                `${standardClientData(challenge, 'android:apk-key-hash:xyz').slice(0, -1)},"other":1}`,
        })
        expect(checkPasskeyUserOpSignature({ signature, userOpHash, publicKey }).valid).toBe(true)
    })

    it('rejects a cryptographically valid signature whose challenge is not at byte 23', () => {
        const signature = signPasskeyUserOp({ userOpHash, privateKey, clientData: sortedClientData })
        expect(checkPasskeyUserOpSignature({ signature, userOpHash, publicKey })).toEqual({
            valid: false,
            reason: 'challenge',
            challengeOffset: 41,
        })
    })

    it('rejects every reordering that moves the challenge off byte 23', () => {
        const orders = [
            (c: string) => `{"challenge":"${c}","type":"webauthn.get","origin":"https://peanut.me"}`,
            (c: string) => `{"origin":"https://peanut.me","type":"webauthn.get","challenge":"${c}"}`,
            (c: string) => `{"type":"webauthn.get","origin":"https://peanut.me","challenge":"${c}"}`,
            (c: string) => `{"type":"webauthn.get", "challenge":"${c}"}`,
        ]
        for (const clientData of orders) {
            const signature = signPasskeyUserOp({ userOpHash, privateKey, clientData })
            const check = checkPasskeyUserOpSignature({ signature, userOpHash, publicKey })
            expect(check.valid).toBe(false)
        }
    })

    it('rejects a challenge for another operation', () => {
        const signature = signPasskeyUserOp({ userOpHash: keccak256(stringToHex('other')), privateKey })
        expect(checkPasskeyUserOpSignature({ signature, userOpHash, publicKey })).toMatchObject({
            valid: false,
            reason: 'challenge',
        })
    })

    it('rejects a signature made by a different passkey', () => {
        const signature = signPasskeyUserOp({ userOpHash, privateKey: passkeyFixture(9).privateKey })
        expect(checkPasskeyUserOpSignature({ signature, userOpHash, publicKey })).toMatchObject({
            valid: false,
            reason: 'signature',
        })
    })

    it('rejects a high-s signature like the contract malleability check', () => {
        const signature = signPasskeyUserOp({ userOpHash, privateKey, highS: true })
        expect(checkPasskeyUserOpSignature({ signature, userOpHash, publicKey })).toMatchObject({ reason: 'high_s' })
    })

    it('rejects an assertion without user verification', () => {
        const signature = signPasskeyUserOp({ userOpHash, privateKey, flags: 0x01 })
        expect(checkPasskeyUserOpSignature({ signature, userOpHash, publicKey })).toMatchObject({ reason: 'flags' })
    })

    it('reports a signature that is not a passkey encoding as malformed', () => {
        expect(checkPasskeyUserOpSignature({ signature: '0x1234', userOpHash, publicKey })).toEqual({
            valid: false,
            reason: 'malformed',
        })
    })
})
