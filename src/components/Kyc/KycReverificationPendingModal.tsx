import { useRouter } from 'next/navigation'
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

    return (
        <ActionModal
            visible={isOpen}
            onClose={onClose}
            icon="clock"
            iconContainerClassName="bg-yellow-1 text-black"
            title="We're reviewing your details"
            description={
                <p>
                    {message ??
                        "Your verification is being reviewed — this usually takes a few minutes. We'll let you know as soon as you're ready to continue. You can wait here or head home."}
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
