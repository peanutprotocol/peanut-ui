import { useRouter } from 'next/navigation'
import ActionModal from '@/components/Global/ActionModal'
import { type IconName } from '@/components/Global/Icons/Icon'

interface KycReverificationPendingModalProps {
    isOpen: boolean
    onClose: () => void
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
export const KycReverificationPendingModal = ({ isOpen, onClose }: KycReverificationPendingModalProps) => {
    const router = useRouter()

    return (
        <ActionModal
            visible={isOpen}
            onClose={onClose}
            icon={'clock' as IconName}
            iconContainerClassName="bg-yellow-1 text-black"
            title="We're reviewing your details"
            description={
                <p>
                    Your verification is being reviewed — this usually takes a few minutes. We&apos;ll let you know as
                    soon as you&apos;re ready to continue. You can wait here or head home.
                </p>
            }
            ctas={[
                {
                    text: 'Go to Home',
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
