import { instructionRows, type RailLabels } from './instructionRows'
import type { DepositAccountView, DepositRowLabels } from './types'

export interface ShareTextCopy {
    /** "Here are my bank details to get paid in {currency}:" */
    introOwn: string
    /** "Bank details to pay {user} in {currency}:" */
    introPooled: string
    /**
     * The account's rules, in the payer's voice. The text is forwarded to
     * people who will never see a Peanut screen, so every rule the app states
     * beside the numbers has to travel with them.
     */
    rules: string[]
    outro: string
}

/**
 * The text a user hands to whoever is paying them.
 *
 * The possessive is one of two cares here. "My bank details" is only true when
 * the account is in the user's own name; where our banking partner holds it,
 * calling it "my account" is a claim we cannot make to a third party. So the
 * framing reads `nameOnAccount` — never a per-string judgement.
 *
 * The other is the rules. In the app we can say who may pay in beside the
 * details; the moment the details are copied out, that sentence is gone and a
 * refused transfer comes back weeks later. So the rules are lines IN the text,
 * not a banner next to it.
 */
export function buildShareText(
    account: DepositAccountView,
    copy: ShareTextCopy,
    rowLabels: DepositRowLabels,
    railLabels: RailLabels
): string {
    if (!account.instructions) return ''

    const lines = [
        account.matching.nameOnAccount === 'user' ? copy.introOwn : copy.introPooled,
        '',
        ...instructionRows(account.instructions, rowLabels, railLabels)
            .filter((row) => row.copyable !== false)
            .map((row) => `${row.label}: ${row.value}`),
    ]

    if (copy.rules.length > 0) lines.push('', ...copy.rules)

    lines.push('', copy.outro)
    return lines.join('\n')
}
