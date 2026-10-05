'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
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
    const [saving, setSaving] = useState(false)
    const savingRef = useRef(false)
    const save = async (event: React.FormEvent) => {
        event.preventDefault()
        if (savingRef.current) return
        setError(undefined)
        const value = email.trim()
        if (!isValidEmail(value)) {
            setError(t('invalid'))
            return
        }
        savingRef.current = true
        setSaving(true)
        // Keep the contact in this flow and proceed regardless of backend
        // availability. Later mailbox changes use Profile verification.
        setNotificationEmail(value)
        if (user?.user.userId && user.user.email !== value) {
            void updateUserById({ userId: user.user.userId, email: value })
                .then((result) => {
                    if (!result.error) void fetchUser().catch(() => {})
                })
                .catch(() => {})
        }
        try {
            await handleNext()
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
            <Button type="submit" shadowSize="4" loading={saving} disabled={saving || !email.trim()}>
                {t('continue')}
            </Button>
        </form>
    )
}
