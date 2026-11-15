import { pixCodePayable, pixDepositQueryKey } from '../pixDepositCode'

const NOW = Date.parse('2026-11-06T12:00:00Z')

describe('pixCodePayable', () => {
    it("reads the owner's code state and checks the expiry again", () => {
        const later = '2026-11-06T12:05:00Z'
        expect(pixCodePayable({ pixDeposit: { codePayable: true, expiresAt: later } }, NOW)).toBe(true)
        expect(pixCodePayable({ pixDeposit: { codePayable: true, expiresAt: null } }, NOW)).toBe(true)
        expect(pixCodePayable({ pixDeposit: { codePayable: true, expiresAt: '2026-11-06T11:59:00Z' } }, NOW)).toBe(
            false
        )
        expect(pixCodePayable({ pixDeposit: { codePayable: false, expiresAt: later } }, NOW)).toBe(false)
        // a shared receipt, or any other entry, carries no code state
        expect(pixCodePayable({}, NOW)).toBe(false)
        expect(pixCodePayable(undefined, NOW)).toBe(false)
    })
})

describe('pixDepositQueryKey', () => {
    it('keys the one query that holds a deposit by its id', () => {
        expect(pixDepositQueryKey('d1')).toEqual(['pix-deposit', 'd1'])
    })
})
