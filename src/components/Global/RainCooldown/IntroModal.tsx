'use client'

import ActionModal from '@/components/Global/ActionModal'
import { useRainCooldown } from '@/context/RainCooldownContext'
import DocsLink from '@/components/Global/DocsLink'

/**
 * Shown the first time the user trips Rain's withdrawal-signature lock in a
 * session, so the floating timer that follows is not mysterious. Dismissing
 * the modal hands off to the persistent `RainCooldownFloatingTimer` widget.
 */
const RainCooldownIntroModal = () => {
    const { showIntroModal, dismissIntroModal } = useRainCooldown()
    // Don't gate on cooldownEndsAt — if the cooldown auto-clears while the
    // modal is still open, ActionModal needs its own `visible=false` cycle
    // to play the exit animation. Returning null mid-render would unmount
    // hard and skip the animation + onClose lifecycle.
    return (
        <ActionModal
            visible={showIntroModal}
            onClose={dismissIntroModal}
            icon="clock"
            iconContainerClassName="bg-yellow-1"
            title="Please wait"
            description={
                <>
                    Your card needs a short cool-down between back-to-back spends. To avoid this in the future, you can
                    lower your card limit to be below your wallet balance; the extra will always be available.
                </>
            }
            ctas={[
                {
                    text: 'Got it',
                    variant: 'purple',
                    shadowSize: '4',
                    onClick: dismissIntroModal,
                },
            ]}
            footer={
                <DocsLink href="/en/help/card-collateral" className="block pt-2 text-center text-sm text-black underline">
                    Read more
                </DocsLink>
            }
        />
    )
}

export default RainCooldownIntroModal
