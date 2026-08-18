'use client'

import { type FC, useState } from 'react'
import { useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import PeanutMascot from '@/components/Global/PeanutMascot'
import { useToast } from '@/components/0_Bruddle/Toast'
import ActionModal, { type ActionModalButtonProps } from '@/components/Global/ActionModal'
import { useAuth } from '@/context/authContext'
import { usersApi } from '@/services/users'

type ModalState = 'closed' | 'confirm' | 'done'

const DeleteAccountButton: FC = () => {
    const t = useTranslations('settings.deleteAccount')
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
            toast.error(t('error'))
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
            text: t('confirmCta'),
            variant: 'purple',
            shadowSize: '4',
            loading: isSubmitting,
            disabled: isSubmitting,
            onClick: confirmDelete,
        },
        {
            text: t('cancelCta'),
            variant: 'stroke',
            shadowSize: '4',
            disabled: isSubmitting,
            onClick: close,
        },
    ]

    const doneCtas: ActionModalButtonProps[] = [
        {
            text: t('doneCta'),
            variant: 'purple',
            shadowSize: '4',
            onClick: finish,
        },
    ]

    const isDone = modalState === 'done'

    return (
        <>
            <button
                type="button"
                onClick={open}
                className="w-full text-center text-sm font-semibold text-error underline underline-offset-2"
            >
                {t('button')}
            </button>

            <ActionModal
                visible={modalState !== 'closed'}
                onClose={close}
                preventClose={lockModal}
                hideModalCloseButton={lockModal}
                icon={
                    isDone ? (
                        <PeanutMascot pose="worried" alt={t('cryingPeanutAlt')} className="size-32" />
                    ) : (
                        <PeanutMascot pose="sad" alt={t('sadPeanutAlt')} className="size-32" />
                    )
                }
                iconContainerClassName="size-32 rounded-none bg-transparent"
                title={isDone ? t('doneTitle') : t('confirmTitle')}
                description={isDone ? t('doneDescription') : t('confirmDescription')}
                ctas={isDone ? doneCtas : confirmCtas}
            />
        </>
    )
}

export default DeleteAccountButton
