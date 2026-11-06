import { aveniaCodePayable, aveniaDepositQueryKey, depositReadFromCreated } from '../aveniaDepositCode'

const NOW = Date.parse('2026-11-06T12:00:00Z')

describe('aveniaCodePayable', () => {
    it("reads the owner's code state and checks the expiry again", () => {
        const later = '2026-11-06T12:05:00Z'
        expect(aveniaCodePayable({ aveniaDeposit: { codePayable: true, expiresAt: later } }, NOW)).toBe(true)
        expect(aveniaCodePayable({ aveniaDeposit: { codePayable: true, expiresAt: null } }, NOW)).toBe(true)
        expect(
            aveniaCodePayable({ aveniaDeposit: { codePayable: true, expiresAt: '2026-11-06T11:59:00Z' } }, NOW)
        ).toBe(false)
        expect(aveniaCodePayable({ aveniaDeposit: { codePayable: false, expiresAt: later } }, NOW)).toBe(false)
        // a shared receipt, or any other entry, carries no code state
        expect(aveniaCodePayable({}, NOW)).toBe(false)
        expect(aveniaCodePayable(undefined, NOW)).toBe(false)
    })
})

describe('depositReadFromCreated', () => {
    it('is the read of a code that can be paid, keyed by the deposit', () => {
        const created = {
            intentId: 'd1',
            brCode: 'code',
            amountBrl: '100.00',
            usdcAmount: '17.94',
            expiresAt: '2026-11-06T12:10:00Z',
            payerCpfMasked: '095.***.***-89',
        }
        expect(depositReadFromCreated(created)).toEqual({
            intentId: 'd1',
            status: 'AWAITING_USER_ACTION',
            ticketStatus: 'UNPAID',
            expiresAt: '2026-11-06T12:10:00Z',
            amountBrl: '100.00',
            usdcAmount: '17.94',
            codePayable: true,
            brCode: 'code',
            payerCpfMasked: '095.***.***-89',
        })
        expect(aveniaDepositQueryKey('d1')).toEqual(['avenia-deposit', 'd1'])
    })
})
