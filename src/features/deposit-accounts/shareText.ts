import { instructionRows, type RailLabels } from './instructionRows'
import type { DepositAccount, DepositRowLabels, SenderPolicy } from './types'

export interface ShareTextCopy {
    /** "Here are my bank details to get paid in {currency}:" */
    introOwn: string
    /** "Bank details to pay {user} in {currency}:" */
    introPooled: string
    /** "Put {memo} in the reference field…" */
    reference?: string
    /**
     * Who may pay in, per policy. The text is forwarded to people who will
     * never see a Peanut screen, so the rule has to travel with the numbers.
     * A policy with nothing to warn about (`anyone`) has no entry.
     */
    senderNotes: Partial<Record<SenderPolicy, string>>
    outro: string
}

/**
 * The text a user hands to whoever is paying them.
 *
 * The possessive is one of two cares here. "My bank details" is only true when
 * the account is in the user's own name; on a pooled corridor the holder is
 * the provider's legal entity, and calling that "my account" is a claim we
 * cannot make to a third party. So the framing reads `nameOnAccount` — never
 * a per-string judgement, and never a per-provider one.
 *
 * The other is the sender rule. In the app we can say "only a company may pay
 * into this" beside the details; the moment the details are copied out, that
 * sentence is gone and a private payer's transfer is returned days later. So
 * the rule is a line IN the text, not a banner next to it.
 */
export function buildShareText(
    account: DepositAccount,
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

    if (account.matching.memo === 'required' && copy.reference) {
        lines.push('', copy.reference)
    }

    const senderNote = copy.senderNotes[account.matching.sender]
    if (senderNote) lines.push('', senderNote)

    lines.push('', copy.outro)
    return lines.join('\n')
}
