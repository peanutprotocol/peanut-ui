import { depositRuleLines } from '../ruleLines'
import type { DepositMatching, DepositRules } from '../types'

const money = (amount: string, currency: string) => `${currency} ${amount}`

const matching = (over: Partial<DepositMatching> = {}): DepositMatching => ({
    nameOnAccount: 'user',
    sender: 'anyone',
    memo: 'none',
    amount: 'flexible',
    ...over,
})

const keysOf = (matchingIn: DepositMatching, rules: DepositRules | undefined) =>
    depositRuleLines(matchingIn, rules, money).map((line) => line.key)

/**
 * The resolver is the one place a rule turns into a sentence. These cases are
 * the product truth in `bridge-contracts-and-rail-rules.md` §3-4: USD anyone
 * capped, a state-restricted USD account, EUR business-only, and a corridor
 * with nothing published (MXN).
 */
describe('depositRuleLines', () => {
    it('USD: anyone, capped, with the family and business exemptions', () => {
        const rules: DepositRules = {
            individualPerPaymentCap: { amount: '4000', currency: 'USD' },
            familySameSurnameExempt: true,
            businessesUnlimited: true,
        }
        const lines = depositRuleLines(matching({ sender: 'anyone' }), rules, money)
        expect(lines.map((l) => l.key)).toEqual(['businessesUnlimited', 'familyExempt', 'individualCap'])
        const cap = lines.find((l) => l.key === 'individualCap')
        expect(cap?.values).toEqual({ cap: 'USD 4000' })
    })

    it('USD, NY/TX: own-name-only carries the state-restricted reason, not the generic one', () => {
        const restricted = matching({ sender: 'own-name-only' })
        expect(keysOf(restricted, { reason: 'state-restricted' })).toEqual(['stateRestricted'])
        // no reason published at all — same policy, different (weaker) claim
        expect(keysOf(restricted, undefined)).toEqual(['ownName'])
    })

    it('EUR: business-only, unlimited for a business, closed to individuals, with a floor', () => {
        const rules: DepositRules = {
            businessesUnlimited: true,
            individualsAllowed: false,
            min: { amount: '1', currency: 'EUR' },
        }
        const lines = depositRuleLines(matching({ sender: 'business-only' }), rules, money)
        expect(lines.map((l) => l.key)).toEqual(['businessesUnlimited', 'individualsNotAllowed', 'minimum'])
    })

    it('GBP: business-only with nothing published states the restriction and stops', () => {
        expect(keysOf(matching({ sender: 'business-only' }), undefined)).toEqual(['businessOnly'])
    })

    it('MXN: nothing published and sender policy is unknown — says only what is confirmed', () => {
        expect(keysOf(matching({ sender: 'unknown' }), undefined)).toEqual(['unpublished'])
    })

    it('a provider-held account states that first, ahead of the sender rule', () => {
        const lines = depositRuleLines(
            matching({ nameOnAccount: 'provider', sender: 'business-only' }),
            undefined,
            money
        )
        expect(lines.map((l) => l.key)).toEqual(['providerHeld', 'businessOnly'])
    })
})
