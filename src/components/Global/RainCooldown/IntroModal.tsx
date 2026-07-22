'use client'

import ActionModal from '@/components/Global/ActionModal'
import { useTranslations } from 'next-intl'
import { useRainCooldown } from '@/context/RainCooldownContext'
import DocsLink from '@/components/Global/DocsLink'

/**
 * Shown the first time the user trips Rain's withdrawal-signature lock in a
 * session, so the floating timer that follows is not mysterious. Dismissing
 * the modal hands off to the persistent `RainCooldownFloatingTimer` widget.
 */
const RainCooldownIntroModal = () => {
    const t = useTranslations('global')
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
            title={t('rainCooldownIntroModal.title')}
            description={t('rainCooldownIntroModal.description')}
            ctas={[
                {
                    text: t('rainCooldownIntroModal.gotItCta'),
                    variant: 'purple',
                    shadowSize: '4',
                    onClick: dismissIntroModal,
                },
            ]}
            footer={
                <DocsLink
                    href="/en/help/card-collateral"
                    className="block pt-2 text-center text-sm text-black underline"
                >
                    {t('rainCooldownIntroModal.readMore')}
                </DocsLink>
            }
        />
    )
}

export default RainCooldownIntroModal
