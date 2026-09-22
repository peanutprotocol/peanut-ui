import { DEPOSIT_RAIL_POLICY } from '../__fixtures__/railPolicy'
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
 * rail-specific docs, as peanut-api-ts serves them — read from the shared
 * fixture table so a rule that changes upstream is wrong in one place.
 *
 * The own-account line is the one that matters most: the old copy said "a
 * payment from a personal account is sent back" on a business-only corridor,
 * which told the holder their OWN top-up would bounce. It never would.
 */
describe('depositRuleLines', () => {
    it('USD: own account yes, a business unlimited, the cap and the family exemption as separate lines', () => {
        const { sender, rules } = DEPOSIT_RAIL_POLICY.ACH_US
        const lines = depositRuleLines(matching({ sender }), rules, money)
        // the family exemption is its own bullet, after the per-payment cap
        expect(lines.map((l) => l.key)).toEqual(['ownAccount', 'businessAny', 'individualCap', 'individualCapFamily'])
        expect(lines.find((l) => l.key === 'individualCap')?.values).toEqual({ cap: 'USD 4000' })
        expect(lines.find((l) => l.key === 'individualCapFamily')?.values).toBeUndefined()
    })

    it('USD, NY/TX: only the holder may pay in, and the state is the reason', () => {
        const restricted = matching({ sender: 'own-name-only' })
        const rules: DepositRules = {
            ownAccount: { allowed: true },
            thirdPartyBusiness: 'unavailable',
            thirdPartyIndividual: { policy: 'unavailable' },
            reason: 'state-restricted',
        }
        expect(keysOf(restricted, rules)).toEqual(['stateRestricted'])
        // no reason published at all — same policy, different (weaker) claim
        expect(keysOf(restricted, undefined)).toEqual(['ownName'])
    })

    it('EUR: own account yes, a business unlimited, another person capped like the US rail, with a floor', () => {
        const { sender, rules } = DEPOSIT_RAIL_POLICY.SEPA_EU
        const lines = depositRuleLines(matching({ sender }), rules, money)
        expect(lines.map((l) => l.key)).toEqual([
            'ownAccount',
            'businessAny',
            'individualCap',
            'individualCapFamily',
            'minimum',
        ])
        expect(lines.find((l) => l.key === 'individualCap')?.values).toEqual({ cap: 'EUR 4000' })
    })

    it('GBP: the same shape, with the sterling floor', () => {
        const { sender, rules } = DEPOSIT_RAIL_POLICY.FASTER_PAYMENTS_GB
        expect(keysOf(matching({ sender }), rules)).toEqual([
            'ownAccount',
            'businessAny',
            'individualNotYet',
            'minimum',
        ])
    })

    /**
     * The peso rail is the one that distinguishes the two limits. The holder's
     * own deposit has a ceiling, and the individual figure is a VOLUME limit
     * with no period published — so it must not render as the per-payment "less
     * than" sentence the dollar rail gets.
     */
    it('MXN: the holder capped, a business unlimited, another person held to a volume limit', () => {
        const { sender, rules } = DEPOSIT_RAIL_POLICY.SPEI_MX
        const lines = depositRuleLines(matching({ sender }), rules, money)
        expect(lines.map((l) => l.key)).toEqual(['ownAccountMax', 'businessAny', 'individualVolume', 'minimum'])
        expect(lines.find((l) => l.key === 'ownAccountMax')?.values).toEqual({ max: 'MXN 1000000' })
        expect(lines.find((l) => l.key === 'individualVolume')?.values).toEqual({ limit: 'MXN 15000' })
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

    it('a corridor that refuses the holder their own top-up never reads as a yes', () => {
        expect(
            keysOf(matching({ sender: 'unknown' }), {
                ownAccount: { allowed: false },
                thirdPartyBusiness: 'unknown',
                thirdPartyIndividual: { policy: 'unknown' },
            })
        ).toEqual(['ownAccountNo', 'businessUnconfirmed', 'individualUnconfirmed'])
    })

    it('ARS and BRL: only the holder pays in, and no third-party line is offered', () => {
        expect(keysOf(matching({ sender: DEPOSIT_RAIL_POLICY.PIX_BR.sender }), undefined)).toEqual(['ownName'])
    })

    it('a provider-held account states that first, ahead of every payer line', () => {
        const { sender, rules } = DEPOSIT_RAIL_POLICY.FASTER_PAYMENTS_GB
        expect(keysOf(matching({ nameOnAccount: 'provider', sender }), rules)).toEqual([
            'providerHeld',
            'ownAccount',
            'businessAny',
            'individualNotYet',
            'minimum',
        ])
    })

    it('unknown ownership makes no holder claim and preserves the sender terms', () => {
        const { sender, rules } = DEPOSIT_RAIL_POLICY.FASTER_PAYMENTS_GB
        expect(keysOf(matching({ nameOnAccount: 'unknown', sender }), rules)).toEqual([
            'ownAccount',
            'businessAny',
            'individualNotYet',
            'minimum',
        ])
    })
})

it('states business support with separate per-payment and monthly limits', () => {
    const lines = depositRuleLines(
        { sender: 'business-only' },
        {
            ownAccount: { allowed: true },
            thirdPartyBusiness: 'allowed',
            thirdPartyIndividual: { policy: 'unavailable' },
            min: { amount: '100', currency: 'COP' },
            max: { amount: '11552000', currency: 'COP' },
            monthlyLimit: { amount: '500000', currency: 'USD' },
        },
        (amount, currency) => `${currency} ${amount}`
    )
    expect(lines).toEqual([
        { key: 'ownAccount' },
        { key: 'businessAllowed' },
        { key: 'individualNotYet' },
        { key: 'minimum', values: { min: 'COP 100' } },
        { key: 'maximum', values: { max: 'COP 11552000' } },
        { key: 'monthlyLimit', values: { limit: 'USD 500000' } },
    ])
})
