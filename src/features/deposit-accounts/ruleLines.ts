import type { DepositRules, DepositSenderTerms } from './types'

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
    | 'ownAccountMax'
    | 'ownAccountNo'
    | 'businessAllowed'
    | 'businessAny'
    | 'businessNotYet'
    | 'businessUnconfirmed'
    | 'individualAny'
    | 'individualCap'
    | 'individualCapFamily'
    | 'individualVolume'
    | 'individualNotYet'
    | 'individualUnconfirmed'
    | 'minimum'
    | 'maximum'
    | 'monthlyLimit'
    | 'stateRestricted'
    | 'ownName'

export interface DepositRuleLine {
    key: DepositRuleKey
    /** already-formatted interpolation values for the catalog string */
    values?: Record<string, string>
}

/** turns an amount into the string the catalog interpolates */
export type FormatMoney = (amount: string, currency: string) => string

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
    matching: DepositSenderTerms,
    rules: DepositRules | undefined,
    formatMoney: FormatMoney
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
    lines.push(ownAccountLine(rules, formatMoney))

    lines.push({ key: businessKey(matching, rules) })
    lines.push(...individualLines(matching, rules, formatMoney))

    if (rules?.min) {
        lines.push({ key: 'minimum', values: { min: formatMoney(rules.min.amount, rules.min.currency) } })
    }

    if (rules?.max) {
        lines.push({ key: 'maximum', values: { max: formatMoney(rules.max.amount, rules.max.currency) } })
    }
    if (rules?.monthlyLimit) {
        lines.push({
            key: 'monthlyLimit',
            values: { limit: formatMoney(rules.monthlyLimit.amount, rules.monthlyLimit.currency) },
        })
    }

    return lines
}

/** a corridor's limit on who may pay in, as a key under depositAccounts.senderLimit */
export type SenderLimitKey = 'businessOnly' | 'othersUnconfirmed'

/**
 * The one line that says who may pay into an account, where the corridor
 * limits it. `anyone` needs none, and `own-name-only` is never shared.
 *
 * One rule for every screen a third party's transfer depends on: the holder's
 * account details, the request toggle that shares them, and the payer's
 * bank-transfer screen. EUR is the case it was written for (QA 2026-09-24):
 * the holder and businesses may pay in, a friend's transfer is returned.
 */
export function senderLimitKey(matching: DepositSenderTerms): SenderLimitKey | undefined {
    if (matching.sender === 'business-only') return 'businessOnly'
    if (matching.sender === 'unknown') return 'othersUnconfirmed'
    return undefined
}

/**
 * What the holder's own transfer may do.
 *
 * A published ceiling is stated as the ceiling; its absence is "yes" and never
 * "unlimited", because no rail page promises an unlimited first-party deposit
 * and a ceiling we have not read is not the same as one that does not exist.
 */
function ownAccountLine(rules: DepositRules | undefined, formatMoney: FormatMoney): DepositRuleLine {
    if (rules?.ownAccount.allowed === false) return { key: 'ownAccountNo' }
    const max = rules?.ownAccount.max
    if (max) return { key: 'ownAccountMax', values: { max: formatMoney(max.amount, max.currency) } }
    return { key: 'ownAccount' }
}

/** what a company transfer may do on this corridor */
function businessKey(matching: DepositSenderTerms, rules: DepositRules | undefined): DepositRuleKey {
    switch (rules?.thirdPartyBusiness) {
        case 'allowed':
            return 'businessAllowed'
        case 'unlimited':
            return 'businessAny'
        case 'unavailable':
            return 'businessNotYet'
        case 'unknown':
            return 'businessUnconfirmed'
    }
    // no published term: `business-only` is itself the statement that a
    // business may pay, and silence about everything else stays silence
    if (matching.sender === 'business-only' || matching.sender === 'anyone') return 'businessAny'
    return 'businessUnconfirmed'
}

/**
 * What a payment from another private person may do on this corridor.
 *
 * `capBelow` and `volumeLimit` are different promises and get different
 * sentences: the first is a per-payment ceiling the payer can plan around, the
 * second is a running total with no period published — so the line says to ask
 * support rather than implying the figure resets every month.
 *
 * A cap with the family exemption is two facts, so it is two lines: the
 * per-payment cap, then the exemption as its own bullet. Crammed into one
 * string the exemption lost its bullet and ran on as a second sentence.
 */
function individualLines(
    matching: DepositSenderTerms,
    rules: DepositRules | undefined,
    formatMoney: FormatMoney
): DepositRuleLine[] {
    const individual = rules?.thirdPartyIndividual
    switch (individual?.policy) {
        case 'allowed':
            return [{ key: 'individualAny' }]
        case 'unavailable':
            return [{ key: 'individualNotYet' }]
        case 'capped': {
            if (individual.capBelow) {
                const { amount, currency } = individual.capBelow
                const cap: DepositRuleLine = { key: 'individualCap', values: { cap: formatMoney(amount, currency) } }
                return individual.familySameSurnameExempt ? [cap, { key: 'individualCapFamily' }] : [cap]
            }
            if (individual.volumeLimit) {
                const { amount, currency } = individual.volumeLimit
                return [{ key: 'individualVolume', values: { limit: formatMoney(amount, currency) } }]
            }
            // capped with no figure states no terms at all
            return [{ key: 'individualUnconfirmed' }]
        }
        case 'unknown':
            return [{ key: 'individualUnconfirmed' }]
    }
    if (matching.sender === 'anyone') return [{ key: 'individualAny' }]
    if (matching.sender === 'business-only') return [{ key: 'individualNotYet' }]
    return [{ key: 'individualUnconfirmed' }]
}
