'use client'
import { useAuth } from '@/context/authContext'
import { Button } from '@/components/0_Bruddle/Button'
import { DynamicBankAccountForm } from '@/components/AddWithdraw/DynamicBankAccountForm'
import { addBankAccount } from '@/app/actions/users'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'

export function EurcBankAccountView({ onSaved, onClose }: { onSaved: () => Promise<void>; onClose: () => void }) {
    const { fetchUser } = useAuth()
    const t = useAppTranslations('currencyAccounts')
    return (
        <div className="flex flex-col gap-3">
            <DynamicBankAccountForm
                country="SEPA"
                flow="withdraw"
                error={null}
                onSuccess={async (payload) => {
                    const result = await addBankAccount(payload)
                    if (result.error || !result.data) return { error: t('actionError') }
                    await fetchUser()
                    await onSaved()
                    return {}
                }}
                onExistingAccount={() => {
                    void onSaved()
                }}
            />
            <Button variant="ghost" onClick={onClose}>
                {t('back')}
            </Button>
        </div>
    )
}
