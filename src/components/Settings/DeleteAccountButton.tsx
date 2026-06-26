'use client'

import { type FC, useState } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { Button } from '@/components/0_Bruddle/Button'
import { useToast } from '@/components/0_Bruddle/Toast'
import ActionModal, { type ActionModalButtonProps } from '@/components/Global/ActionModal'
import { useAuth } from '@/context/authContext'
import { accountApi } from '@/services/account'

type Phase = 'confirm' | 'done'

const DeleteAccountButton: FC = () => {
    const { logoutUser } = useAuth()
    const toast = useToast()
    const [isOpen, setIsOpen] = useState(false)
    const [phase, setPhase] = useState<Phase>('confirm')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const open = () => {
        setPhase('confirm')
        setIsOpen(true)
        posthog.capture(ANALYTICS_EVENTS.DELETE_ACCOUNT_INITIATED)
    }

    const close = () => {
        if (isSubmitting) return
        setIsOpen(false)
    }

    const confirmDelete = async () => {
        setIsSubmitting(true)
        posthog.capture(ANALYTICS_EVENTS.DELETE_ACCOUNT_CONFIRMED)
        try {
            await accountApi.requestDeletion()
            setPhase('done')
        } catch (error) {
            posthog.capture(ANALYTICS_EVENTS.DELETE_ACCOUNT_FAILED)
            toast.error('Could not delete your account. Please try again.')
        } finally {
            setIsSubmitting(false)
        }
    }

    // After the user reads the notice, clear local session and redirect — they
    // can no longer log back in (login is blocked server-side).
    const finish = () => {
        logoutUser({ skipBackendCall: true })
    }

    const confirmCtas: ActionModalButtonProps[] = [
        {
            text: 'Delete My Account',
            variant: 'purple',
            shadowSize: '4',
            loading: isSubmitting,
            disabled: isSubmitting,
            onClick: confirmDelete,
        },
        {
            text: 'Cancel',
            variant: 'stroke',
            disabled: isSubmitting,
            onClick: close,
        },
    ]

    const doneCtas: ActionModalButtonProps[] = [
        {
            text: 'Got it',
            variant: 'purple',
            shadowSize: '4',
            onClick: finish,
        },
    ]

    return (
        <>
            <Button variant="stroke" className="w-full" onClick={open}>
                Delete My Account
            </Button>

            <ActionModal
                visible={isOpen}
                onClose={close}
                preventClose={isSubmitting || phase === 'done'}
                hideModalCloseButton={isSubmitting || phase === 'done'}
                icon="alert"
                iconContainerClassName="bg-yellow-1"
                title={phase === 'confirm' ? 'Delete your account?' : 'Account deletion requested'}
                description={
                    phase === 'confirm'
                        ? 'This action is irreversible. Your account will be disabled now and your data deleted within 30 days.'
                        : 'Your account and data will be deleted within 30 days. You will now be signed out.'
                }
                ctas={phase === 'confirm' ? confirmCtas : doneCtas}
            />
        </>
    )
}

export default DeleteAccountButton
