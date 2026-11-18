'use client'

import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
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
    // another account that is not established holds it: KYC moves it there once the inbox is verified
    const [deferred, setDeferred] = useState(false)
    const [fieldError, setFieldError] = useState<string | null>(null)
    const pending = useRef(false)
    const save = async () => {
        if (pending.current) return
        setError(null)
        setFieldError(null)
        setDeferred(false)
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
            if ('code' in response && response.code === 'EMAIL_ON_DORMANT_ACCOUNT') {
                setDeferred(true)
                return
            }
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
    const skip = () => {
        if (!pending.current) onSkip()
    }
    // a drawer, not a modal: design.md "default to a drawer" (Kush, 2026-11-18); swipe, overlay and back skip
    return (
        <Drawer
            open
            dismissible={!saving}
            onOpenChange={(open) => {
                if (!open) skip()
            }}
        >
            <DrawerContent>
                <div className="flex flex-col items-center pt-1 pb-6 text-center">
                    <div className="flex w-full flex-col items-center gap-4">
                        <IconBubble size="m" icon="info" color="blue" />
                        <DrawerHeader className="mb-3 w-full gap-1 p-0 text-center sm:text-center">
                            <DrawerTitle>{t('title')}</DrawerTitle>
                            <DrawerDescription>{t('description')}</DrawerDescription>
                        </DrawerHeader>
                    </div>
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
                        {deferred && (
                            <Callout priority="info" className="mt-2">
                                {t('deferred')}
                            </Callout>
                        )}
                    </div>
                    <Button
                        variant="primary"
                        shadowSize="4"
                        className="mt-4 w-full justify-center"
                        onClick={() => void save()}
                        disabled={saving || !email.trim()}
                    >
                        {common(saving ? 'saving' : 'save')}
                    </Button>
                    <LinkButton className="mt-6" onClick={skip} disabled={saving}>
                        {common('notNow')}
                    </LinkButton>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
