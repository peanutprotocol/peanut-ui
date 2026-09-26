import { instructionRows, type RailLabels } from './instructionRows'
import { corridorFromRailId } from './rails'
import type { DepositAccountView, DepositRowLabels } from './types'

export interface ShareTextCopy {
    /** "Here are my bank details to get paid in {currency}:" */
    introOwn: string
    /** "Bank details to pay {user} in {currency}:" */
    introPooled: string
    outro: string
    /**
     * Who may pay, in one line, where the corridor limits it — the payer's
     * voice of `senderLimit`, the same line the payer's bank-transfer screen
     * shows. Absent when anyone may pay.
     */
    payerLine?: string
    /** "Add the reference to every transfer …" — only where the account has one */
    referenceLine: string
    /**
     * The euro caveat. EUR is offered to anyone, and the one third-party SEPA
     * transfer seen so far was returned by the provider as a third-party
     * payment; until a third-party credit is proven, the payer is told to use
     * an account in their own name where they can.
     */
    eurOwnNameLine: string
}

/**
 * The text a user hands to whoever is paying them: the account fields and the
 * "Sent from Peanut" footer, and nothing else.
 *
 * The possessive is the one care here. "My bank details" is only true when the
 * account is in the user's own name; where our banking partner holds it,
 * calling it "my account" is a claim we cannot make to a third party. An
 * unverified holder relationship is neutral for the same reason. So the
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

    if (copy.payerLine) lines.push('', copy.payerLine)
    // A reference row alone reads as one more field to copy; the payer has to
    // know the transfer is not matched without it.
    if (account.instructions.depositMessage) lines.push('', copy.referenceLine)
    if (corridorFromRailId(account.railId) === 'SEPA_EU') lines.push('', copy.eurOwnNameLine)

    lines.push('', copy.outro)
    return lines.join('\n')
}
