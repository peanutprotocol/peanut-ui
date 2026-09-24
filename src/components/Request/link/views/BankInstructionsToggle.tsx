'use client'

import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Toggle } from '@/components/0_Bruddle/Toggle'
import { firstPayableCorridor } from '@/features/deposit-accounts/rails'
import { canShare } from '@/features/deposit-accounts/resolveScreen'
import { SKELETON_PULSE } from '@/features/deposit-accounts/skeleton'
import { useDepositAccountCopy } from '@/features/deposit-accounts/useDepositAccountCopy'
import { useDepositAccounts } from '@/features/deposit-accounts/useDepositAccounts'
import { useTranslations } from 'next-intl'
import { twMerge } from '@/utils/tw'

/**
 * Let the payer settle this request straight into the requester's bank
 * account.
 *
 * On by default (QA 2026-09-24), and only offered to a user who holds an
 * account the money could arrive in. Offering it otherwise would promise a payer bank details
 * that do not exist, and the request would sit open waiting for a transfer
 * nobody could make.
 *
 * The corridor decides more than that. An account that only credits a transfer
 * from its own holder has nothing a third party can pay into, so the option is
 * not offered at all; a corridor that limits who may pay says so in the same
 * line the account details and the payer's screen show (`senderLimit`).
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
    const { accounts, gates, isLoading } = useDepositAccounts()
    const { senderLimit } = useDepositAccountCopy()

    // Hold the row's place while the accounts load, so the row does not
    // appear later and push Create down under the user's thumb.
    if (isLoading) return <BankInstructionsToggleSkeleton />

    // Offer the opt-in only when these details could actually be paid: the same
    // test the Share action runs — an active account with live instructions on a
    // corridor whose gate is open. Rejecting own-name-only alone let a blocked or
    // detail-less account promise a payer bank details it cannot honor.
    const corridor = firstPayableCorridor(accounts)
    const account = corridor ? accounts[corridor] : undefined
    const gate = corridor ? gates[corridor] : undefined
    if (!account || !gate || !canShare(account, gate)) return null

    // One title for both positions (Konrad, 2026-09-23). While it is on, one
    // line says what a payer sees: the requester's full legal name leaves with
    // the details, and the profile asks before it shows that name at all. A
    // corridor that limits who may pay adds its warning to the same line.
    const senderLine = senderLimit(account.matching)?.text

    return (
        <ListItem
            position="solo"
            className="w-full"
            title={t('bankInstructions.title')}
            body={checked ? [t('bankInstructions.disclosure'), senderLine].filter(Boolean).join(' ') : undefined}
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

/** The loaded row, slot for slot: a one-line title and a toggle. */
function BankInstructionsToggleSkeleton() {
    return (
        <ListItem
            position="solo"
            className="w-full"
            data-testid="bank-instructions-toggle-skeleton"
            title={<div className={twMerge(SKELETON_PULSE, 'h-5 w-48')} />}
            trailing={<div className={twMerge(SKELETON_PULSE, 'h-6 w-11 rounded-full')} />}
        />
    )
}
