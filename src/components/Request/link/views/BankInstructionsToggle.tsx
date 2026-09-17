'use client'

import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Toggle } from '@/components/0_Bruddle/Toggle'
import { useDepositAccounts } from '@/features/deposit-accounts/useDepositAccounts'
import { useTranslations } from 'next-intl'

/**
 * Let the payer settle this request straight into the requester's bank
 * account.
 *
 * Off by default, and only offered to a user who holds an account the money
 * could arrive in. Offering it otherwise would promise a payer bank details
 * that do not exist, and the request would sit open waiting for a transfer
 * nobody could make.
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

    const hasActiveAccount = Object.values(accounts).some((account) => account?.status === 'active')
    if (!hasActiveAccount) return null

    return (
        <ListItem
            position="single"
            className="w-full"
            title={t('bankInstructions.title')}
            body={<div className="text-body-xs">{t('bankInstructions.description')}</div>}
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
