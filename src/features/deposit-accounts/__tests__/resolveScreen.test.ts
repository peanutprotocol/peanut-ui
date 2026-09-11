import { DEPOSIT_RAILS } from '../rails'
import { resolveScreen } from '../resolveScreen'
import type { DepositAccount } from '../types'
import type { GateState } from '@/utils/capability-gate'

const READY: GateState = { kind: 'ready' }
const BLOCKED: GateState = { kind: 'needs-identity' }

const account = (over: Partial<DepositAccount> = {}): DepositAccount => ({
    corridor: 'EUR_SEPA',
    currency: 'EUR',
    provider: 'bridge',
    status: 'active',
    matching: { nameOnAccount: 'user', sender: 'anyone', memo: 'none', amount: 'flexible' },
    instructions: { accountHolderName: 'Ana Pérez', paymentRails: ['sepa'] },
    ...over,
})

const eur = DEPOSIT_RAILS.EUR_SEPA
const ars = DEPOSIT_RAILS.ARS_TRANSFER

/**
 * The URL is a user input. These are the ways a hand-edited or stale link
 * could otherwise put somebody on a screen that promises the wrong thing.
 */
describe('resolveScreen', () => {
    it('sends a share link for own-name-only details back to the details', () => {
        const own = account({
            corridor: 'ARS_TRANSFER',
            matching: { nameOnAccount: 'provider', sender: 'own-name-only', memo: 'none', amount: 'exact' },
        })
        expect(resolveScreen('share', ars, own, READY)).toBe('details')
    })

    it('will not share a corridor whose sender policy is unproved', () => {
        const unproved = account({ matching: { ...account().matching, sender: 'unknown' } })
        expect(resolveScreen('share', eur, unproved, READY)).toBe('details')
    })

    it('will not share an account that is not active yet', () => {
        expect(resolveScreen('share', eur, account({ status: 'provisioning' }), READY)).toBe('details')
    })

    it('does not offer to claim an account the user already holds', () => {
        expect(resolveScreen('claim', eur, account(), READY)).toBe('details')
    })

    it('does not offer to claim while the gate is not ready', () => {
        expect(resolveScreen('claim', eur, undefined, BLOCKED)).toBe('list')
    })

    it('does not offer to claim a corridor that cannot be held', () => {
        expect(resolveScreen('claim', ars, undefined, READY)).toBe('list')
    })

    it('sends details with no account to the claim step', () => {
        expect(resolveScreen('details', eur, undefined, READY)).toBe('claim')
    })

    it('keeps a revoked account on its details, where the reason is', () => {
        expect(resolveScreen('details', eur, account({ status: 'revoked' }), READY)).toBe('details')
    })

    it('passes a legitimate share through', () => {
        expect(resolveScreen('share', eur, account(), READY)).toBe('share')
    })
})
