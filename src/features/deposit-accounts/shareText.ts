import { instructionRows } from './instructionRows'
import type { DepositAccount, DepositRowLabels } from './types'

export interface ShareTextCopy {
    /** "Here are my bank details to get paid in {currency}:" */
    introOwn: string
    /** "Bank details to pay {user} in {currency}:" */
    introPooled: string
    /** "Put {memo} in the reference field…" */
    reference?: string
    outro: string
}

/**
 * The text a user hands to whoever is paying them.
 *
 * The possessive is the whole care here. "My bank details" is only true when
 * the account is in the user's own name; on a pooled corridor the holder is
 * the provider's legal entity, and calling that "my account" is a claim we
 * cannot make to a third party. So the framing reads `nameOnAccount` — never
 * a per-string judgement, and never a per-provider one.
 */
export function buildShareText(account: DepositAccount, copy: ShareTextCopy, rowLabels: DepositRowLabels): string {
    if (!account.instructions) return ''

    const lines = [
        account.matching.nameOnAccount === 'user' ? copy.introOwn : copy.introPooled,
        '',
        ...instructionRows(account.instructions, rowLabels)
            .filter((row) => row.copyable !== false)
            .map((row) => `${row.label}: ${row.value}`),
    ]

    if (account.matching.memo === 'required' && copy.reference) {
        lines.push('', copy.reference)
    }

    lines.push('', copy.outro)
    return lines.join('\n')
}
