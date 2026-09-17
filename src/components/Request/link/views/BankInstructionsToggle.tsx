'use client'

import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Toggle } from '@/components/0_Bruddle/Toggle'
import { DEPOSIT_RAIL_ORDER } from '@/features/deposit-accounts/rails'
import { useDepositAccounts } from '@/features/deposit-accounts/useDepositAccounts'
import { useTranslations } from 'next-intl'

/** the one line the toggle may say about who is allowed to pay this request */
const SENDER_LINE_KEYS = {
    anyone: 'bankInstructions.anyonePays',
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
    const { accounts } = useDepositAccounts()

    const account = DEPOSIT_RAIL_ORDER.map((corridor) => accounts[corridor]).find((held) => held?.status === 'active')
    if (!account) return null

    const sender = account.matching.sender
    if (sender === 'own-name-only') return null

    return (
        <ListItem
            position="single"
            className="w-full"
            title={t('bankInstructions.title')}
            body={
                <div className="text-body-xs">
                    {t('bankInstructions.description')} {t(SENDER_LINE_KEYS[sender])}
                </div>
            }
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
