import { verifyMessage } from 'viem'
import {
    GUEST_CLAIM_ERROR_CODES,
    getSendLinkPubKey,
    guestBankAccountMessage,
    guestBankClaimMessage,
    guestClaimErrorKind,
    signWithLinkKey,
} from '../guest-claim.utils'
import { generateKeysFromString } from '../peanut-link.utils'

const LINK = 'https://peanut.me/claim?c=42161&v=v4.3&i=7#p=guest-claim-test-secret'

describe('guest claim messages', () => {
    // peanut-api-ts src/bridge/guest-claim.ts builds the same strings; its
    // unit test pins the same literals.
    it('match the API byte for byte', () => {
        expect(guestBankAccountMessage('0xABCdef0000000000000000000000000000000001')).toBe(
            'Peanut: add a bank account to claim send link 0xabcdef0000000000000000000000000000000001'
        )
        expect(guestBankClaimMessage('0xABCdef0000000000000000000000000000000001', 'ext-1')).toBe(
            'Peanut: claim send link 0xabcdef0000000000000000000000000000000001 to bank account ext-1'
        )
    })
})

describe('signWithLinkKey', () => {
    it("signs with the link's own key, so the signature recovers to the link pubKey", async () => {
        const pubKey = getSendLinkPubKey(LINK)
        expect(pubKey).toBe(generateKeysFromString('guest-claim-test-secret').address)

        const message = guestBankClaimMessage(pubKey, 'ext-1')
        const signature = await signWithLinkKey(LINK, message)

        expect(
            await verifyMessage({ address: pubKey as `0x${string}`, message, signature: signature as `0x${string}` })
        ).toBe(true)
    })
})

describe('guestClaimErrorKind', () => {
    it.each([
        [GUEST_CLAIM_ERROR_CODES.overLimit, 400, 'overLimit'],
        [GUEST_CLAIM_ERROR_CODES.alreadyClaimed, 409, 'alreadyClaimed'],
        [GUEST_CLAIM_ERROR_CODES.linkNotClaimable, 409, 'notClaimable'],
        [GUEST_CLAIM_ERROR_CODES.senderNotEligible, 409, 'unsupported'],
        [GUEST_CLAIM_ERROR_CODES.invalidSignature, 403, 'linkInvalid'],
        [GUEST_CLAIM_ERROR_CODES.amountMismatch, 400, 'linkInvalid'],
    ])('maps %s to %s copy', (code, status, kind) => {
        expect(guestClaimErrorKind(code, status)).toBe(kind)
    })

    it('treats a 403 without a code as the residence block — unsupported', () => {
        expect(guestClaimErrorKind(undefined, 403)).toBe('unsupported')
    })

    it('leaves anything else to the API message', () => {
        expect(guestClaimErrorKind(undefined, 422)).toBeNull()
        expect(guestClaimErrorKind(undefined, undefined)).toBeNull()
    })
})
