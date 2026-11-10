import { aveniaCodePayable, aveniaDepositQueryKey } from '../aveniaDepositCode'

const NOW = Date.parse('2026-11-06T12:00:00Z')

describe('aveniaCodePayable', () => {
    it("reads the owner's code state and checks the expiry again", () => {
        const later = '2026-11-06T12:05:00Z'
        expect(aveniaCodePayable({ pixDeposit: { codePayable: true, expiresAt: later } }, NOW)).toBe(true)
        expect(aveniaCodePayable({ pixDeposit: { codePayable: true, expiresAt: null } }, NOW)).toBe(true)
        expect(aveniaCodePayable({ pixDeposit: { codePayable: true, expiresAt: '2026-11-06T11:59:00Z' } }, NOW)).toBe(
            false
        )
        expect(aveniaCodePayable({ pixDeposit: { codePayable: false, expiresAt: later } }, NOW)).toBe(false)
        // a shared receipt, or any other entry, carries no code state
        expect(aveniaCodePayable({}, NOW)).toBe(false)
        expect(aveniaCodePayable(undefined, NOW)).toBe(false)
    })
})

describe('aveniaDepositQueryKey', () => {
    it('keys the one query that holds a deposit by its id', () => {
        expect(aveniaDepositQueryKey('d1')).toEqual(['avenia-deposit', 'd1'])
    })
})
