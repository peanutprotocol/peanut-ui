'use client'

import { useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import NavHeader from '@/components/Global/NavHeader'
import { updateUserById } from '@/app/actions/users'
import { useAuth } from '@/context/authContext'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useTranslations } from 'next-intl'

interface OfframpHandleGateViewProps {
    onBack: () => void
    /** Called once the handle is saved — the caller reveals the deposit address. */
    onDone: () => void
}

// Required gate in front of the offramp migration deposit screen: migrants
// must self-report which offramp.xyz account they're migrating from before the
// deposit address is revealed. Peanut owes the partner a per-migrant payout,
// so this is what reconciliation keys on. Deliberately unverified — asking is
// enough of a deterrent against farming the public campaign link.
const OfframpHandleGateView = ({ onBack, onDone }: OfframpHandleGateViewProps) => {
    const { user, fetchUser } = useAuth()
    const t = useTranslations('addMoney')
    const tCommon = useTranslations('common')
    const [handle, setHandle] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const trimmedHandle = handle.trim()
    const canSubmit = trimmedHandle.length >= 3 && !!user?.user.userId && !isSaving

    const handleSubmit = async () => {
        if (!canSubmit) return
        setIsSaving(true)
        setError(null)
        const { error: apiError } = await updateUserById({
            userId: user!.user.userId,
            offrampHandle: trimmedHandle,
        })
        if (apiError) {
            setError(t('offrampGate.error'))
            setIsSaving(false)
            return
        }
        posthog.capture(ANALYTICS_EVENTS.OFFRAMP_HANDLE_SUBMITTED)
        // refresh the cached user so the gate stays passed on future visits;
        // onDone doesn't wait on it — the handle is already persisted.
        fetchUser().catch(() => {})
        onDone()
    }

    return (
        <div className="flex min-h-[inherit] w-full flex-col gap-8 pb-5 md:pb-0">
            <NavHeader title={t('methods.migrateFromOfframp')} onPrev={onBack} />
            <div className="my-auto flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                    <h2 className="text-xl font-extrabold">{t('offrampGate.title')}</h2>
                    <p className="text-base font-medium text-grey-1">{t('offrampGate.description')}</p>
                </div>
                <div className="flex flex-col gap-2">
                    <BaseInput
                        type="text"
                        value={handle}
                        onChange={(e) => setHandle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                        placeholder={t('offrampGate.placeholder')}
                        maxLength={320}
                        autoFocus
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                    />
                    {error && <p className="text-sm font-medium text-error">{error}</p>}
                </div>
                <Button
                    variant="purple"
                    shadowSize="4"
                    className="w-full"
                    disabled={!canSubmit}
                    loading={isSaving}
                    onClick={handleSubmit}
                >
                    {tCommon('continue')}
                </Button>
            </div>
        </div>
    )
}

export default OfframpHandleGateView
