'use client'

import ActionModal from '@/components/Global/ActionModal'
import { useRainCooldown } from '@/context/RainCooldownContext'

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
            title="One spend at a time"
            description="Your card needs a short cool-down between back-to-back spends from collateral. We'll keep a timer in the corner — try again once it hits zero."
            ctas={[
                {
                    text: 'Got it',
                    variant: 'purple',
                    shadowSize: '4',
                    onClick: dismissIntroModal,
                },
            ]}
        />
    )
}

export default RainCooldownIntroModal
