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
    | 'ownAccount'
    | 'businessAny'
    | 'businessNotYet'
    | 'businessUnconfirmed'
    | 'individualAny'
    | 'individualCap'
    | 'individualCapFamily'
    | 'individualNotYet'
    | 'individualUnconfirmed'
    | 'minimum'
    | 'stateRestricted'
    | 'ownName'

export interface DepositRuleLine {
    key: DepositRuleKey
    /** already-formatted interpolation values for the catalog string */
    values?: Record<string, string>
}

/**
 * The rules for one account, in the order a user needs them: who holds it,
 * then each payer in turn — the user's own account, a business, another
 * person — and finally the floor.
 *
 * Three lines, always the same three, because the question a holder has is
 * "can THIS person pay me" and a missing line reads as a yes. Where the rail
 * publishes nothing about a payer, the line says so rather than disappearing:
 * "not confirmed" is an answer, silence is not.
 */
export function depositRuleLines(
    matching: DepositMatching,
    rules: DepositRules | undefined,
    formatMoney: (amount: string, currency: string) => string
): DepositRuleLine[] {
    const lines: DepositRuleLine[] = []

    if (matching.nameOnAccount === 'provider') lines.push({ key: 'providerHeld' })

    // Nobody but the holder may pay in, so there is no third-party answer to
    // give and the two lines below would both read "no".
    if (matching.sender === 'own-name-only') {
        lines.push({ key: rules?.reason === 'state-restricted' ? 'stateRestricted' : 'ownName' })
        return lines
    }

    // The user's OWN transfer is not a third-party payment, and no rail
    // restricts it. Saying so first is the fix for copy that read
    // "a payment from a personal account is sent back" on a business-only
    // corridor — which forbade the user's own top-up, the one payment that
    // always works. The Add-money bank row leads here now, so that sentence
    // was telling users their own deposit would bounce.
    lines.push({ key: 'ownAccount' })

    lines.push({ key: businessKey(matching, rules) })
    lines.push(individualLine(matching, rules, formatMoney))

    if (rules?.min) {
        lines.push({ key: 'minimum', values: { min: formatMoney(rules.min.amount, rules.min.currency) } })
    }

    return lines
}

/** what a company transfer may do on this corridor */
function businessKey(matching: DepositMatching, rules: DepositRules | undefined): DepositRuleKey {
    if (rules?.businessesUnlimited === true) return 'businessAny'
    if (rules?.businessesUnlimited === false) return 'businessNotYet'
    // no published term: `business-only` is itself the statement that a
    // business may pay, and silence about everything else stays silence
    if (matching.sender === 'business-only' || matching.sender === 'anyone') return 'businessAny'
    return 'businessUnconfirmed'
}

/** what a payment from another private person may do on this corridor */
function individualLine(
    matching: DepositMatching,
    rules: DepositRules | undefined,
    formatMoney: (amount: string, currency: string) => string
): DepositRuleLine {
    if (rules?.individualsAllowed === false) return { key: 'individualNotYet' }
    if (rules?.individualPerPaymentCap) {
        const { amount, currency } = rules.individualPerPaymentCap
        return {
            key: rules.familySameSurnameExempt ? 'individualCapFamily' : 'individualCap',
            values: { cap: formatMoney(amount, currency) },
        }
    }
    if (matching.sender === 'anyone') return { key: 'individualAny' }
    if (matching.sender === 'business-only') return { key: 'individualNotYet' }
    return { key: 'individualUnconfirmed' }
}
