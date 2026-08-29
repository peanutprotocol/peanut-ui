import { initialDepositStep } from '../capability-gate'

describe('initialDepositStep', () => {
    it('holds until the gate resolves — entering on the amount and jumping would flash the wrong screen', () => {
        expect(initialDepositStep('loading')).toBeNull()
    })

    it('sends an unverified user to verification before it asks for a number', () => {
        expect(initialDepositStep('needs-identity')).toBe('verify')
        expect(initialDepositStep('needs-enrollment')).toBe('verify')
        expect(initialDepositStep('fixable-rejection')).toBe('verify')
        expect(initialDepositStep('blocked-rejection')).toBe('verify')
        expect(initialDepositStep('restart-identity')).toBe('verify')
        expect(initialDepositStep('waiting-on-provider')).toBe('verify')
    })

    it('opens a verified user straight on the amount', () => {
        expect(initialDepositStep('ready')).toBe('inputAmount')
    })

    it('does not give the tos consent a screen — the amount step guards it inline', () => {
        expect(initialDepositStep('accept-tos')).toBe('inputAmount')
    })
})
