import { isVerifiableGate, nextDepositStep } from '../capability-gate'

describe('nextDepositStep', () => {
    it('holds until the gate resolves — entering on the amount and jumping would flash the wrong screen', () => {
        expect(nextDepositStep(undefined, 'loading')).toBeNull()
        expect(nextDepositStep('inputAmount', 'loading')).toBeNull()
    })

    it('sends a user who can act on their verification there before asking for a number', () => {
        expect(nextDepositStep(undefined, 'needs-identity')).toBe('verify')
        expect(nextDepositStep(undefined, 'needs-enrollment')).toBe('verify')
        expect(nextDepositStep(undefined, 'fixable-rejection')).toBe('verify')
        expect(nextDepositStep(undefined, 'blocked-rejection')).toBe('verify')
        expect(nextDepositStep(undefined, 'restart-identity')).toBe('verify')
        expect(nextDepositStep(undefined, 'provide-email')).toBe('verify')
    })

    // These resolve to the default "Unlock now" screen, which would offer a
    // fresh Sumsub run to someone whose only correct move is to wait.
    it('keeps wait-only gates off the verification screen', () => {
        expect(nextDepositStep(undefined, 'pending')).toBe('inputAmount')
        expect(nextDepositStep(undefined, 'waiting-on-provider')).toBe('inputAmount')
        expect(isVerifiableGate('pending')).toBe(false)
        expect(isVerifiableGate('waiting-on-provider')).toBe(false)
    })

    it('opens a verified user straight on the amount', () => {
        expect(nextDepositStep(undefined, 'ready')).toBe('inputAmount')
    })

    it('does not give the tos consent a screen — the amount step guards it inline', () => {
        expect(nextDepositStep(undefined, 'accept-tos')).toBe('inputAmount')
    })

    // A bookmarked or shared ?step=inputAmount must not walk around the
    // verification-first ordering.
    it('pulls a stale amount URL back to verification when the gate calls for it', () => {
        expect(nextDepositStep('inputAmount', 'needs-identity')).toBe('verify')
    })

    it('releases the verify step once the gate stops calling for it', () => {
        expect(nextDepositStep('verify', 'ready')).toBe('inputAmount')
        expect(nextDepositStep('verify', 'accept-tos')).toBe('inputAmount')
    })

    it('leaves a step that is already right alone, so the effect cannot loop', () => {
        expect(nextDepositStep('inputAmount', 'ready')).toBeNull()
        expect(nextDepositStep('verify', 'needs-identity')).toBeNull()
    })

    // showDetails has a live transfer id behind it — never rewrite it.
    it('never moves a flow that is already showing bank details', () => {
        expect(nextDepositStep('showDetails', 'needs-identity')).toBeNull()
        expect(nextDepositStep('showDetails', 'ready')).toBeNull()
    })
})
