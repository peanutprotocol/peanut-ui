import { depositRuleLines } from '../ruleLines'
import type { DepositMatching, DepositRules } from '../types'

const money = (amount: string, currency: string) => `${currency} ${amount}`

const matching = (over: Partial<DepositMatching> = {}): DepositMatching => ({
    nameOnAccount: 'user',
    sender: 'anyone',
    ...over,
})

const keysOf = (matchingIn: DepositMatching, rules: DepositRules | undefined) =>
    depositRuleLines(matchingIn, rules, money).map((line) => line.key)

/**
 * The resolver is the one place a rule turns into a sentence, and it answers
 * one question per payer: your own account, a business, another person. The
 * rails below are the published terms in
 * `product/providers/fiat/bridge-contracts-and-rail-rules.md` §3 and Bridge's
 * rail-specific docs, as peanut-api-ts serves them.
 *
 * The own-account line is the one that matters most: the old copy said "a
 * payment from a personal account is sent back" on a business-only corridor,
 * which told the holder their OWN top-up would bounce. It never would.
 */
describe('depositRuleLines', () => {
    it('USD: own account and a business unlimited, another person under the cap, family exempt', () => {
        const rules: DepositRules = {
            individualPerPaymentCap: { amount: '4000', currency: 'USD' },
            familySameSurnameExempt: true,
            businessesUnlimited: true,
        }
        const lines = depositRuleLines(matching({ sender: 'anyone' }), rules, money)
        expect(lines.map((l) => l.key)).toEqual(['ownAccount', 'businessAny', 'individualCapFamily'])
        expect(lines.find((l) => l.key === 'individualCapFamily')?.values).toEqual({ cap: 'USD 4000' })
    })

    it('USD, NY/TX: only the holder may pay in, and the state is the reason', () => {
        const restricted = matching({ sender: 'own-name-only' })
        expect(keysOf(restricted, { reason: 'state-restricted' })).toEqual(['stateRestricted'])
        // no reason published at all — same policy, different (weaker) claim
        expect(keysOf(restricted, undefined)).toEqual(['ownName'])
    })

    it('EUR: own account any amount, a business unlimited, another person not yet, with a floor', () => {
        const rules: DepositRules = {
            businessesUnlimited: true,
            individualsAllowed: false,
            min: { amount: '1', currency: 'EUR' },
        }
        expect(keysOf(matching({ sender: 'business-only' }), rules)).toEqual([
            'ownAccount',
            'businessAny',
            'individualNotYet',
            'minimum',
        ])
    })

    it('GBP: the same shape, with the sterling floor', () => {
        const rules: DepositRules = {
            businessesUnlimited: true,
            individualsAllowed: false,
            min: { amount: '2', currency: 'GBP' },
        }
        expect(keysOf(matching({ sender: 'business-only' }), rules)).toEqual([
            'ownAccount',
            'businessAny',
            'individualNotYet',
            'minimum',
        ])
    })

    it('MXN: a business unlimited, another person capped per payment with no family exemption', () => {
        const rules: DepositRules = {
            individualPerPaymentCap: { amount: '15000', currency: 'MXN' },
            businessesUnlimited: true,
            min: { amount: '50', currency: 'MXN' },
        }
        const lines = depositRuleLines(matching({ sender: 'anyone' }), rules, money)
        expect(lines.map((l) => l.key)).toEqual(['ownAccount', 'businessAny', 'individualCap', 'minimum'])
        expect(lines.find((l) => l.key === 'individualCap')?.values).toEqual({ cap: 'MXN 15000' })
    })

    /**
     * A corridor nobody has published terms for still answers all three
     * questions. "Not confirmed" beside the details is what lets a holder
     * judge before copying a single field; an absent line reads as a yes.
     */
    it('a corridor with nothing published says so, payer by payer', () => {
        expect(keysOf(matching({ sender: 'unknown' }), undefined)).toEqual([
            'ownAccount',
            'businessUnconfirmed',
            'individualUnconfirmed',
        ])
    })

    it('ARS and BRL: only the holder pays in, and no third-party line is offered', () => {
        expect(keysOf(matching({ sender: 'own-name-only' }), undefined)).toEqual(['ownName'])
    })

    it('a provider-held account states that first, ahead of every payer line', () => {
        expect(keysOf(matching({ nameOnAccount: 'provider', sender: 'business-only' }), undefined)).toEqual([
            'providerHeld',
            'ownAccount',
            'businessAny',
            'individualNotYet',
        ])
    })
})
