'use client'

import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import SetupFooter from '../components/SetupFooter'
import ProfileEditField from '@/components/Profile/components/ProfileEditField'
import { useAuth } from '@/context/authContext'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { updateUserById } from '@/app/actions/users'
import { isValidEmail } from '@/utils/format.utils'
import { USER } from '@/constants/query.consts'
import type { IUserProfile } from '@/interfaces/interfaces'
import { SetupDocLink } from '../components/SetupDocsDrawer'
import { LINK_BUTTON_CLASSES } from '@/components/0_Bruddle/LinkButton'
import { Icon } from '@/components/Global/Icons/Icon'

export default function EmailStep() {
    const t = useTranslations('setup.email')
    const { user, fetchUser } = useAuth()
    const queryClient = useQueryClient()
    const { notificationEmail, setNotificationEmail, setIsLoading: setSetupLoading } = useSetupFlowContext()
    const { handleNext } = useSetupFlow()
    const [email, setEmail] = useState(notificationEmail || user?.user.email || '')
    const [error, setError] = useState<string>()
    const [emailInUse, setEmailInUse] = useState(false)
    const [saving, setSaving] = useState(false)
    const savingRef = useRef(false)
    const save = async (event: React.FormEvent) => {
        event.preventDefault()
        if (savingRef.current) return
        setError(undefined)
        setEmailInUse(false)
        const value = email.trim()
        if (!isValidEmail(value)) {
            setError(t('invalid'))
            return
        }
        if (!user?.user.userId) {
            setError(t('notReady'))
            return
        }
        savingRef.current = true
        setSaving(true)
        setSetupLoading(true)
        // The flow retains the draft across Next/Back remounts. Only leave
        // after the API confirms the required contact has been saved.
        setNotificationEmail(value)
        try {
            if (user.user.email !== value) {
                const result = await updateUserById({ userId: user.user.userId, email: value })
                if (result.error) {
                    const duplicate = result.error === 'This email is already associated with another account'
                    setEmailInUse(duplicate)
                    setError(t(duplicate ? 'alreadyRegistered' : 'saveFailed'))
                    return
                }
                // Profile and KYC read this shared account cache. Reflect the
                // acknowledged write even if the background refresh fails.
                queryClient.setQueryData<IUserProfile | null>([USER], (profile) => {
                    if (profile?.user.userId !== user.user.userId) return profile
                    return { ...profile, user: { ...profile.user, email: value } }
                })
                void fetchUser().catch(() => {})
            }
            await handleNext()
        } catch {
            setError(t('saveFailed'))
        } finally {
            savingRef.current = false
            setSaving(false)
            setSetupLoading(false)
        }
    }
    return (
        <form onSubmit={save} noValidate className="flex w-full flex-1 flex-col">
            <div className="flex flex-1 flex-col justify-center">
                <ProfileEditField
                    label={t('label')}
                    inputSize="md"
                    type="email"
                    name="email"
                    autoComplete="email"
                    inputMode="email"
                    maxLength={254}
                    value={email}
                    onChange={(value) => {
                        setEmail(value)
                        setError(undefined)
                        setEmailInUse(false)
                    }}
                    placeholder={t('placeholder')}
                    error={error}
                    disabled={saving}
                />
            </div>
            <SetupFooter
                actions={
                    <Button type="submit" shadowSize="4" loading={saving} disabled={saving || !email.trim()}>
                        {t('continue')}
                    </Button>
                }
            >
                {emailInUse && (
                    <SetupDocLink
                        kind="account-recovery"
                        href="/en/help/account-recovery"
                        className={LINK_BUTTON_CLASSES}
                    >
                        <Icon name="info" size={16} className="shrink-0" />
                        {t('recoveryGuide')}
                    </SetupDocLink>
                )}
            </SetupFooter>
        </form>
    )
}
