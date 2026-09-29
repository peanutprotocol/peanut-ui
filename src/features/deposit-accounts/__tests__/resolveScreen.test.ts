import { DEPOSIT_RAILS } from '../rails'
import { canShare, resolveScreen } from '../resolveScreen'
import type { DepositAccount } from '../types'
import type { GateState } from '@/utils/capability-gate'

const READY: GateState = { kind: 'ready' }
const BLOCKED: GateState = { kind: 'needs-identity' }

const account = (over: Partial<DepositAccount> = {}): DepositAccount => ({
    id: 'acc_1',
    railId: 'bridge.sepa_eu',
    country: 'EU',
    currency: 'EUR',
    isPrimary: true,
    status: 'active',
    matching: { nameOnAccount: 'user', sender: 'anyone' },
    instructions: { accountHolderName: 'Ana Pérez', paymentRails: ['sepa'] },
    ...over,
})

const eur = DEPOSIT_RAILS.SEPA_EU
const ars = DEPOSIT_RAILS.BANK_TRANSFER_AR

/**
 * The URL is a user input. These are the ways a hand-edited or stale link
 * could otherwise put somebody on a screen that promises the wrong thing.
 */
describe('resolveScreen', () => {
    it('sends a share link for own-name-only details back to the details', () => {
        const own = account({
            railId: 'manteca.bank_transfer_ar',
            matching: { nameOnAccount: 'provider', sender: 'own-name-only' },
        })
        expect(canShare(own, READY)).toBe(false)
    })

    it('shares a corridor whose sender policy is unproved', () => {
        // Bridge names a restriction where it has one. Silence about EUR is not
        // a restriction, and withholding the share screen over it would hide a
        // working feature — the copy carries the uncertainty instead.
        const unproved = account({ matching: { ...account().matching, sender: 'unknown' } })
        expect(canShare(unproved, READY)).toBe(true)
    })

    it('will not share an account that is not active yet', () => {
        expect(canShare(account({ status: 'provisioning' }), READY)).toBe(false)
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

    // A corridor nobody can hold has no account, no claim and no screen of its
    // own — the row on the list points straight at its top-up flow, which
    // states its own verification rule. A link naming one lands on the list.
    it('sends a corridor that cannot be held back to the list', () => {
        expect(resolveScreen('details', ars, undefined, READY)).toBe('list')
    })

    it('keeps a revoked account on its details, where the reason is', () => {
        expect(resolveScreen('details', eur, account({ status: 'revoked' }), READY)).toBe('details')
    })

    it('passes a legitimate share through', () => {
        expect(canShare(account(), READY)).toBe(true)
    })
})

/**
 * The footer and the resolver have to give the same answer. They did not: the
 * footer asked the sender policy alone, so a retiring account, one without
 * details, or one whose gate had since closed offered a Share button the
 * resolver refused.
 */
/**
 * A revoked corridor has no claim route. The provider's create call is
 * idempotent per customer and currency, so claiming again returns the same
 * dead account rather than a replacement — an "open new details" button would
 * loop into the same failure. The screen offers support instead.
 */
describe('resolveScreen on a revoked corridor', () => {
    const revoked = account({ status: 'revoked' })

    it('never reaches the claim step, whatever the gate says', () => {
        expect(resolveScreen('claim', eur, revoked, READY)).toBe('details')
        expect(resolveScreen('claim', eur, revoked, BLOCKED)).toBe('details')
    })

    it('serves the revoked details, which explain why money sent there comes back', () => {
        expect(resolveScreen('details', eur, revoked, READY)).toBe('details')
    })

    it('does not offer to share details that no longer receive', () => {
        expect(canShare(revoked, READY)).toBe(false)
    })
})

describe('canShare', () => {
    it('only allows active, usable details with a ready gate', () => {
        const cases = [
            account(),
            account({ status: 'retiring' }),
            account({ status: 'provisioning' }),
            account({ instructions: undefined }),
            account({ matching: { nameOnAccount: 'user', sender: 'own-name-only' } }),
        ]
        for (const gate of [READY, BLOCKED]) {
            for (const [index, candidate] of cases.entries()) {
                expect(canShare(candidate, gate)).toBe(gate === READY && index === 0)
            }
        }
    })
})
