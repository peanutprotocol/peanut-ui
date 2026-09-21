import { instructionRows, type RailLabels } from './instructionRows'
import type { DepositAccountView, DepositRowLabels } from './types'

export interface ShareTextCopy {
    /** "Here are my bank details to get paid in {currency}:" */
    introOwn: string
    /** "Bank details to pay {user} in {currency}:" */
    introPooled: string
    outro: string
    /**
     * Who may pay, in one line, for the policies where a payer can get it
     * wrong. `anyone` has no line: nothing to warn about. `own-name-only` has
     * none either: those details are never shared.
     */
    payerLine: { 'business-only': string; unknown: string }
}

/**
 * The text a user hands to whoever is paying them: the account fields and the
 * "Sent from Peanut" footer, and nothing else.
 *
 * The possessive is the one care here. "My bank details" is only true when the
 * account is in the user's own name; where our banking partner holds it,
 * calling it "my account" is a claim we cannot make to a third party. So the
 * framing reads `nameOnAccount` — never a per-string judgement.
 *
 * The holder's full terms are NOT in the copied text: they render on screen
 * for the holder, and QA found the message cluttered with them. One line stays
 * where the payer can get it wrong: a friend who pays business-only details
 * from a personal account gets the transfer returned, and only this message
 * can tell them before they send.
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

    const sender = account.matching.sender
    if (sender === 'business-only' || sender === 'unknown') lines.push('', copy.payerLine[sender])

    lines.push('', copy.outro)
    return lines.join('\n')
}
