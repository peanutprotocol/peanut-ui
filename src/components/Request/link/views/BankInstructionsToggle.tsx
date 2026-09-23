'use client'

import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Toggle } from '@/components/0_Bruddle/Toggle'
import { firstPayableCorridor } from '@/features/deposit-accounts/rails'
import { canShare } from '@/features/deposit-accounts/resolveScreen'
import { useDepositAccounts } from '@/features/deposit-accounts/useDepositAccounts'
import { useTranslations } from 'next-intl'

/**
 * The one line the toggle says, and only where the corridor changes who may
 * pay. For an account anybody can pay into, the title says it all.
 */
const SENDER_LINE_KEYS = {
    anyone: undefined,
    'business-only': 'bankInstructions.businessPays',
    unknown: 'bankInstructions.unknownPays',
} as const

/**
 * Let the payer settle this request straight into the requester's bank
 * account.
 *
 * Off by default, and only offered to a user who holds an account the money
 * could arrive in. Offering it otherwise would promise a payer bank details
 * that do not exist, and the request would sit open waiting for a transfer
 * nobody could make.
 *
 * The corridor decides more than that. An account that only credits a transfer
 * from its own holder has nothing a third party can pay into, so the option is
 * not offered at all; a corridor that takes business money alone returns a
 * friend's transfer, so the requester reads that before they share the link.
 * Both come from the sender policy of the SAME account the payer will be given
 * — the first active one, in catalogue order, as the deposit-instructions route
 * picks it.
 *
 * Only shown before the request exists: create sets the flag, and nothing
 * updates it afterwards. A user who changes their mind makes another request
 * rather than quietly withdrawing details a payer may already have.
 */
export function BankInstructionsToggle({
    checked,
    onChange,
    disabled,
}: {
    checked: boolean
    onChange: (value: boolean) => void
    disabled?: boolean
}) {
    const t = useTranslations('request')
    const { accounts, gates } = useDepositAccounts()

    // Offer the opt-in only when these details could actually be paid: the same
    // test the Share action runs — an active account with live instructions on a
    // corridor whose gate is open. Rejecting own-name-only alone let a blocked or
    // detail-less account promise a payer bank details it cannot honor.
    const corridor = firstPayableCorridor(accounts)
    const account = corridor ? accounts[corridor] : undefined
    const gate = corridor ? gates[corridor] : undefined
    if (!account || !gate || !canShare(account, gate)) return null

    const sender = account.matching.sender
    // canShare already excludes own-name-only; this narrows the copy-line type.
    if (sender === 'own-name-only') return null

    // One title for both positions and no body line (Konrad, 2026-09-23):
    // the title already says what switching it on does. The only line left is
    // the one that changes what happens to a payer's money, and it only
    // matters once the details are shared.
    const senderLine = checked ? SENDER_LINE_KEYS[sender] : undefined

    return (
        <ListItem
            position="solo"
            className="w-full"
            // ListItem truncates a string title, and the es/pt titles run past
            // one line at 375px. A node title wraps.
            title={<span className="break-words whitespace-normal">{t('bankInstructions.title')}</span>}
            body={senderLine ? <div className="text-body-xs">{t(senderLine)}</div> : undefined}
            bodyWrap
            trailing={
                <Toggle
                    checked={checked}
                    onChange={onChange}
                    disabled={disabled}
                    aria-label={t('bankInstructions.title')}
                    data-testid="bank-instructions-toggle"
                />
            }
        />
    )
}
