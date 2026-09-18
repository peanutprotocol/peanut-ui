import { instructionRows, type RailLabels } from './instructionRows'
import type { DepositAccountView, DepositRowLabels } from './types'

export interface ShareTextCopy {
    /** "Here are my bank details to get paid in {currency}:" */
    introOwn: string
    /** "Bank details to pay {user} in {currency}:" */
    introPooled: string
    outro: string
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
 * The who-can-pay rules are deliberately NOT in the copied text: they render on
 * screen for the holder, but a payer pasting these fields into a transfer form
 * does not need the holder's terms in the message, so the text stays the
 * account details a bank form asks for.
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

    lines.push('', copy.outro)
    return lines.join('\n')
}
