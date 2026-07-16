import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import ActionModal from '@/components/Global/ActionModal'

interface KycReverificationPendingModalProps {
    isOpen: boolean
    onClose: () => void
    // backend-specific review copy (gate.userMessage); falls back to generic text.
    message?: string
}

/**
 * Shown when the user tries to on/offramp via Bridge while Bridge is still
 * re-reviewing their submitted info (e.g. right after an EEA uplift). This maps
 * to the `waiting-on-provider` gate — the user has no action to take but wait.
 *
 * The parent ties `isOpen` to the gate, so the modal auto-dismisses the moment
 * Bridge finishes (the capability poller — re-armed via markSubmitted when this
 * opens — flips the gate away from `waiting-on-provider`).
 */
export const KycReverificationPendingModal = ({ isOpen, onClose, message }: KycReverificationPendingModalProps) => {
    const router = useRouter()
    const t = useTranslations('kyc')
    const tCommon = useTranslations('common')

    return (
        <ActionModal
            visible={isOpen}
            onClose={onClose}
            icon="clock"
            iconContainerClassName="bg-yellow-1 text-black"
            title={t('reverificationPending.title')}
            description={<p>{message ?? t('reverificationPending.description')}</p>}
            ctas={[
                {
                    text: tCommon('goToHome'),
                    onClick: () => {
                        onClose()
                        router.push('/home')
                    },
                    variant: 'purple',
                    className: 'w-full',
                    shadowSize: '4',
                },
            ]}
        />
    )
}
