'use client'

import { type FC, useState } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { PeanutSad, PeanutCrying, PeanutPointing } from '@/assets/mascot'
import { useToast } from '@/components/0_Bruddle/Toast'
import ActionModal, { type ActionModalButtonProps } from '@/components/Global/ActionModal'
import { useAuth } from '@/context/authContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { AccountHasBalanceError, usersApi } from '@/services/users'
import { DELETION_BALANCE_DUST_UNITS } from '@/utils/balance.utils'

type ModalState = 'closed' | 'blocked' | 'confirm' | 'done'

type Step = {
    mascot: string
    mascotAlt: string
    title: string
    description: string
    ctas: ActionModalButtonProps[]
}

// A big animated mascot at the top of the modal instead of the tiny alert icon.
// `unoptimized` keeps the animated WebP playing (Next's optimizer flattens it).
const Mascot: FC<{ src: string; alt: string }> = ({ src, alt }) => (
    <Image src={src} alt={alt} width={128} height={128} unoptimized className="size-32 object-contain" />
)

const DeleteAccountButton: FC = () => {
    const t = useTranslations('settings.deleteAccount')
    const { logoutUser } = useAuth()
    const { spendableBalance, formattedSpendableBalance } = useWallet()
    const router = useRouter()
    const toast = useToast()
    const [modalState, setModalState] = useState<ModalState>('closed')
    const [isSubmitting, setIsSubmitting] = useState(false)
    // Amount to show on the blocked step. Null means "use the live wallet
    // figure" — it is only set when the server refused a request the client had
    // waved through (stale/unreadable local balance), and then the server's
    // number is the one that actually blocked the deletion.
    const [blockedAmount, setBlockedAmount] = useState<string | null>(null)

    // Deletion is irreversible — login is blocked forever and there is no
    // reactivation path — so funds left behind can never be reached again.
    const hasFundsToMove = spendableBalance !== undefined && spendableBalance >= DELETION_BALANCE_DUST_UNITS

    const block = (amount: string | null) => {
        setBlockedAmount(amount)
        setModalState('blocked')
        posthog.capture(ANALYTICS_EVENTS.DELETE_ACCOUNT_BLOCKED_BALANCE)
    }

    const open = () => {
        posthog.capture(ANALYTICS_EVENTS.DELETE_ACCOUNT_INITIATED)
        // A balance that hasn't loaded yet falls through to the confirm step —
        // the server runs the same gate and refuses on a live read.
        if (hasFundsToMove) block(null)
        else setModalState('confirm')
    }

    const close = () => {
        if (isSubmitting) return
        setModalState('closed')
    }

    const moveMoney = () => {
        setModalState('closed')
        router.push('/withdraw')
    }

    const confirmDelete = async () => {
        setIsSubmitting(true)
        posthog.capture(ANALYTICS_EVENTS.DELETE_ACCOUNT_CONFIRMED)
        try {
            await usersApi.requestDeletion()
            setModalState('done')
        } catch (error) {
            if (error instanceof AccountHasBalanceError) {
                block(error.balanceUsd)
            } else {
                posthog.capture(ANALYTICS_EVENTS.DELETE_ACCOUNT_FAILED)
                toast.error(t('error'))
            }
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

    // One descriptor per step, so the mascot, copy and CTAs of a step are read
    // and edited together instead of as four parallel branches. `closed` keeps
    // the confirm content: the modal is hidden, but it still renders.
    const steps: Record<Exclude<ModalState, 'closed'>, Step> = {
        blocked: {
            mascot: PeanutPointing.src,
            mascotAlt: t('pointingPeanutAlt'),
            title: t('blockedTitle'),
            description: t('blockedDescription', { amount: blockedAmount ?? formattedSpendableBalance }),
            ctas: [
                { text: t('blockedCta'), variant: 'purple', shadowSize: '4', onClick: moveMoney },
                { text: t('blockedCancelCta'), variant: 'stroke', shadowSize: '4', onClick: close },
            ],
        },
        confirm: {
            mascot: PeanutSad.src,
            mascotAlt: t('sadPeanutAlt'),
            title: t('confirmTitle'),
            description: t('confirmDescription'),
            ctas: [
                {
                    text: t('confirmCta'),
                    variant: 'purple',
                    shadowSize: '4',
                    loading: isSubmitting,
                    disabled: isSubmitting,
                    onClick: confirmDelete,
                },
                { text: t('cancelCta'), variant: 'stroke', shadowSize: '4', disabled: isSubmitting, onClick: close },
            ],
        },
        done: {
            mascot: PeanutCrying.src,
            mascotAlt: t('cryingPeanutAlt'),
            title: t('doneTitle'),
            description: t('doneDescription'),
            ctas: [{ text: t('doneCta'), variant: 'purple', shadowSize: '4', onClick: finish }],
        },
    }

    const step = steps[modalState === 'closed' ? 'confirm' : modalState]

    return (
        <>
            <button
                type="button"
                onClick={open}
                className="w-full text-center text-body-s font-semibold text-foreground-error underline underline-offset-2"
            >
                {t('button')}
            </button>

            <ActionModal
                visible={modalState !== 'closed'}
                onClose={close}
                preventClose={lockModal}
                hideModalCloseButton={lockModal}
                icon={<Mascot src={step.mascot} alt={step.mascotAlt} />}
                iconContainerClassName="size-32 rounded-none bg-transparent"
                title={step.title}
                description={step.description}
                ctas={step.ctas}
            />
        </>
    )
}

export default DeleteAccountButton
