import { isStaleClientForUser, isStaleKeyError, createStaleSessionError } from '@/utils/walletCredential.utils'

describe('isStaleClientForUser', () => {
    const accountA = '0xAAAAaaAAaAAAAAaaAAaaAAaaaAAAAAaAAaAAaAaa'
    const accountB = '0xBBBBbbBBbBBBBBbbBBbbBBbbbBBBBBbBBbBBbBbb'

    it('flags a client whose address differs from the user (wrong passkey)', () => {
        expect(isStaleClientForUser(accountA, accountB)).toBe(true)
    })

    it('accepts a client whose address matches the user', () => {
        expect(isStaleClientForUser(accountA, accountA)).toBe(false)
    })

    it('matches case-insensitively (EIP-55 checksum vs lowercase)', () => {
        expect(isStaleClientForUser(accountA.toLowerCase(), accountA)).toBe(false)
    })

    it('does not flag when the user has no smart-wallet address yet (mid-registration)', () => {
        expect(isStaleClientForUser(accountA, undefined)).toBe(false)
    })

    it('does not flag when the client has no derived address', () => {
        expect(isStaleClientForUser(undefined, accountB)).toBe(false)
    })
})

describe('isStaleKeyError', () => {
    it('recognises an error we tagged ourselves', () => {
        expect(isStaleKeyError(createStaleSessionError())).toBe(true)
    })

    it('recognises an on-chain AA24 signature error', () => {
        expect(isStaleKeyError(new Error('UserOperation reverted with reason: AA24 signature error'))).toBe(true)
    })

    it('recognises ZeroDev wapk-unauthorized', () => {
        expect(isStaleKeyError('wapk: unauthorized')).toBe(true)
    })

    it('does not flag a generic unauthorized / 401', () => {
        expect(isStaleKeyError(new Error('401 unauthorized'))).toBe(false)
    })

    it('does not flag an unrelated error', () => {
        expect(isStaleKeyError(new Error('network request failed'))).toBe(false)
    })
})
