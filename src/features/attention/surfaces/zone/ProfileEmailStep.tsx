'use client'

import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import ActionModal from '@/components/Global/ActionModal'
import ProfileEditField from '@/components/Profile/components/ProfileEditField'
import { Callout } from '@/components/0_Bruddle/Callout'
import { FieldError } from '@/components/0_Bruddle/FieldError'
import { useAuth } from '@/context/authContext'
import { updateUserById } from '@/app/actions/users'
import { isValidEmail } from '@/utils/format.utils'

export default function ProfileEmailStep({ onComplete, onSkip }: { onComplete: () => void; onSkip: () => void }) {
    const t = useTranslations('home.carousel.addEmail')
    const common = useTranslations('kyc.provideEmail')
    const { user, fetchUser } = useAuth()
    const [email, setEmail] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [fieldError, setFieldError] = useState<string | null>(null)
    const pending = useRef(false)
    const save = async () => {
        if (pending.current) return
        setError(null)
        setFieldError(null)
        const trimmed = email.trim()
        if (!isValidEmail(trimmed)) {
            setFieldError(common('invalidEmail'))
            return
        }
        const userId = user?.user.userId
        if (!userId) {
            setError(common('stillLoading'))
            return
        }
        pending.current = true
        setSaving(true)
        try {
            const response = await updateUserById({ userId, email: trimmed })
            if (response.error) {
                setError(response.error)
                return
            }
            await fetchUser()
            onComplete()
        } catch {
            setError(common('saveFailed'))
        } finally {
            pending.current = false
            setSaving(false)
        }
    }
    return (
        <ActionModal
            visible
            title={t('title')}
            description={t('description')}
            tone="info"
            onClose={() => {
                if (!pending.current) onSkip()
            }}
            ctas={[
                {
                    text: common(saving ? 'saving' : 'save'),
                    onClick: save,
                    disabled: saving || !email.trim(),
                    variant: 'primary',
                    shadowSize: '4',
                },
            ]}
            tertiaryCta={{
                text: common('notNow'),
                disabled: saving,
                onClick: () => {
                    if (!pending.current) onSkip()
                },
            }}
            content={
                <div className="w-full text-left">
                    <ProfileEditField
                        label={common('emailLabel')}
                        placeholder={common('emailPlaceholder')}
                        value={email}
                        onChange={setEmail}
                        type="email"
                    />
                    {fieldError && <FieldError>{fieldError}</FieldError>}
                    {error && <Callout priority="error">{error}</Callout>}
                </div>
            }
        />
    )
}
