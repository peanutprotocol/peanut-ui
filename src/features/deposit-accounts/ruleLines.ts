import type { DepositMatching, DepositRules } from './types'

/**
 * One sentence the screens are allowed to say about an account, derived from
 * `matching` and `rules` and from nothing else.
 *
 * Every rule a user reads — on the hub, on the details, on the claim step and
 * in the text that leaves the app — comes through here, so the app can never
 * say one thing beside the numbers and another inside them. The catalog holds
 * three strings per key: `line` addresses the holder, `payer` addresses
 * whoever is paying them, and `why` is the longer explanation behind the (i).
 */
export type DepositRuleKey =
    | 'providerHeld'
    | 'anyone'
    | 'businessesUnlimited'
    | 'familyExempt'
    | 'individualCap'
    | 'individualsNotAllowed'
    | 'businessOnly'
    | 'minimum'
    | 'stateRestricted'
    | 'ownName'
    | 'unpublished'

export interface DepositRuleLine {
    key: DepositRuleKey
    /** already-formatted interpolation values for the catalog string */
    values?: Record<string, string>
}

/**
 * The rules for one account, in the order a user needs them: who holds it,
 * then who may pay in, then on what terms.
 *
 * A rule is stated only where the response carries it. An account with no
 * `rules` at all is the common case — Bridge publishes terms for two corridors
 * and is silent about the rest — and silence gets the one sentence that is
 * true everywhere rather than a guess dressed as a promise.
 */
export function depositRuleLines(
    matching: DepositMatching,
    rules: DepositRules | undefined,
    formatMoney: (amount: string, currency: string) => string
): DepositRuleLine[] {
    const lines: DepositRuleLine[] = []

    if (matching.nameOnAccount === 'provider') lines.push({ key: 'providerHeld' })

    if (matching.sender === 'own-name-only') {
        lines.push({ key: rules?.reason === 'state-restricted' ? 'stateRestricted' : 'ownName' })
        return lines
    }

    if (rules?.businessesUnlimited) lines.push({ key: 'businessesUnlimited' })
    if (rules?.familySameSurnameExempt) lines.push({ key: 'familyExempt' })
    if (rules?.individualPerPaymentCap) {
        const { amount, currency } = rules.individualPerPaymentCap
        lines.push({ key: 'individualCap', values: { cap: formatMoney(amount, currency) } })
    }
    if (rules?.individualsAllowed === false) lines.push({ key: 'individualsNotAllowed' })
    if (rules?.min) {
        lines.push({ key: 'minimum', values: { min: formatMoney(rules.min.amount, rules.min.currency) } })
    }

    // Nothing published for this corridor. `business-only` is itself a
    // published restriction and says so; `anyone` and `unknown` differ only in
    // what we may promise, so `unknown` states what every corridor does and
    // stops there.
    if (!lines.some((line) => line.key !== 'providerHeld')) {
        if (matching.sender === 'business-only') lines.push({ key: 'businessOnly' })
        else if (matching.sender === 'anyone') lines.push({ key: 'anyone' })
        else lines.push({ key: 'unpublished' })
    }

    return lines
}
