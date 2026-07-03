'use client'

import { useCallback, useEffect, useState } from 'react'
import ActionModal from '@/components/Global/ActionModal'
import ProfileEditField from '@/components/Profile/components/ProfileEditField'
import { updateUserById } from '@/app/actions/users'
import { useAuth } from '@/context/authContext'
import { isValidEmail } from '@/utils/format.utils'
import type { IconName } from '@/components/Global/Icons/Icon'

interface ProvideEmailStepProps {
    visible: boolean
    onComplete: () => void
    onSkip: () => void
}

/**
 * Self-serve recovery for the no-email KYC dead-end: the BE emits a
 * `provide-email` NextAction when provider submission failed because no email
 * was ever captured. Saving an email here flips the blocked rails back to
 * PENDING server-side and re-runs submission automatically — no support
 * ticket needed. (Shell mirrors BridgeTosStep.)
 */
export default function ProvideEmailStep({ visible, onComplete, onSkip }: ProvideEmailStepProps) {
    const { user, fetchUser } = useAuth()
    const [email, setEmail] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (visible) {
            setEmail('')
            setError(null)
        }
    }, [visible])

    const handleSave = useCallback(async () => {
        const trimmed = email.trim()
        if (!isValidEmail(trimmed)) {
            setError('Please enter a valid email address.')
            return
        }
        const userId = user?.user?.userId
        if (!userId) {
            setError('Still loading your account — please try again in a moment.')
            return
        }
        setIsSaving(true)
        setError(null)
        try {
            const response = await updateUserById({ userId, email: trimmed })
            if (response.error) {
                setError(response.error)
                return
            }
            // The BE resubmits the blocked rails on email set; refetch so the
            // provide-email gate clears (rails go PENDING → the UI shows the
            // normal in-progress state instead of this modal).
            await fetchUser()
            onComplete()
        } catch {
            setError('Something went wrong saving your email. Please try again.')
        } finally {
            setIsSaving(false)
        }
    }, [email, user?.user?.userId, fetchUser, onComplete])

    return (
        <ActionModal
            visible={visible}
            onClose={onSkip}
            icon={'user-id' as IconName}
            title="Add your email to continue"
            description="We couldn't finish setting up your account because we're missing an email address. Add one and we'll retry automatically."
            ctas={[
                {
                    text: isSaving ? 'Saving...' : 'Save email',
                    onClick: handleSave,
                    disabled: isSaving || email.trim().length === 0,
                    variant: 'purple',
                    className: 'w-full',
                    shadowSize: '4',
                },
                {
                    text: 'Not now',
                    onClick: onSkip,
                    variant: 'transparent' as const,
                    className: 'underline text-sm font-medium w-full h-fit mt-3',
                },
            ]}
            content={
                <div className="w-full pt-2 text-left">
                    <ProfileEditField
                        label="Email"
                        value={email}
                        onChange={setEmail}
                        placeholder="you@example.com"
                        type="email"
                    />
                    {error && <p className="mt-2 text-sm text-error">{error}</p>}
                </div>
            }
        />
    )
}
