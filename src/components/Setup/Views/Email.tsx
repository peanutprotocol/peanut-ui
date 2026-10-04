'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import ProfileEditField from '@/components/Profile/components/ProfileEditField'
import { useAuth } from '@/context/authContext'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { updateUserById } from '@/app/actions/users'
import { isValidEmail } from '@/utils/format.utils'

export default function EmailStep() {
    const t = useTranslations('setup.email')
    const { user, fetchUser } = useAuth()
    const { notificationEmail, setNotificationEmail } = useSetupFlowContext()
    const { handleNext } = useSetupFlow()
    const [email, setEmail] = useState(notificationEmail || user?.user.email || '')
    const [error, setError] = useState<string>()
    const [saveError, setSaveError] = useState<string>()
    const [saving, setSaving] = useState(false)
    const savingRef = useRef(false)
    const save = async (event: React.FormEvent) => {
        event.preventDefault()
        if (savingRef.current) return
        setError(undefined)
        setSaveError(undefined)
        const value = email.trim()
        if (!isValidEmail(value)) {
            setError(t('invalid'))
            return
        }
        if (!user?.user.userId) {
            setSaveError(t('notReady'))
            return
        }
        savingRef.current = true
        setSaving(true)
        try {
            // A first email can be saved without a verification code. Subsequent
            // changes use Profile's existing verified-email change flow.
            const result =
                user.user.email === value ? {} : await updateUserById({ userId: user.user.userId, email: value })
            if (result.error) {
                setSaveError(t('saveFailed'))
                return
            }
            setNotificationEmail(value)
            void fetchUser().catch(() => {})
            await handleNext()
        } catch {
            setSaveError(t('saveFailed'))
        } finally {
            savingRef.current = false
            setSaving(false)
        }
    }
    return (
        <form onSubmit={save} noValidate className="flex w-full flex-col gap-4">
            <ProfileEditField
                label={t('label')}
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                maxLength={254}
                value={email}
                onChange={setEmail}
                placeholder={t('placeholder')}
                error={error}
                disabled={saving}
            />
            {saveError && <Callout priority="error">{saveError}</Callout>}
            <Button type="submit" shadowSize="4" loading={saving} disabled={saving || !email.trim()}>
                {t('continue')}
            </Button>
            <p className="text-body-xs text-foreground-secondary">{t('accessHint')}</p>
        </form>
    )
}
