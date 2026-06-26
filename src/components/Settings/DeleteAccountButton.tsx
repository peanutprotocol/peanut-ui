'use client'

import { type FC, useState } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { Button } from '@/components/0_Bruddle/Button'
import { useToast } from '@/components/0_Bruddle/Toast'
import ActionModal, { type ActionModalButtonProps } from '@/components/Global/ActionModal'
import { useAuth } from '@/context/authContext'
import { usersApi } from '@/services/users'

type ModalState = 'closed' | 'confirm' | 'done'

const DeleteAccountButton: FC = () => {
    const { logoutUser } = useAuth()
    const toast = useToast()
    const [modalState, setModalState] = useState<ModalState>('closed')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const open = () => {
        setModalState('confirm')
        posthog.capture(ANALYTICS_EVENTS.DELETE_ACCOUNT_INITIATED)
    }

    const close = () => {
        if (isSubmitting) return
        setModalState('closed')
    }

    const confirmDelete = async () => {
        setIsSubmitting(true)
        posthog.capture(ANALYTICS_EVENTS.DELETE_ACCOUNT_CONFIRMED)
        try {
            await usersApi.requestDeletion()
            setModalState('done')
        } catch {
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

    // Once submitting (or on the final notice) the modal can't be dismissed —
    // the user must complete the flow through the CTA.
    const lockModal = isSubmitting || modalState === 'done'

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
                visible={modalState !== 'closed'}
                onClose={close}
                preventClose={lockModal}
                hideModalCloseButton={lockModal}
                icon="alert"
                iconContainerClassName="bg-yellow-1"
                title={modalState === 'done' ? 'Account deletion requested' : 'Delete your account?'}
                description={
                    modalState === 'done'
                        ? 'Your account and data will be deleted within 30 days. You will now be signed out.'
                        : 'This action is irreversible. Your account will be disabled now and your data deleted within 30 days.'
                }
                ctas={modalState === 'done' ? doneCtas : confirmCtas}
            />
        </>
    )
}

export default DeleteAccountButton
