'use client'

import ActionModal from '@/components/Global/ActionModal'
import { useTranslations } from 'next-intl'
import { useRainCooldown } from '@/context/RainCooldownContext'
import DocsLink from '@/components/Global/DocsLink'
import { LINK_BUTTON_CLASSES } from '@/components/0_Bruddle/LinkButton'

/**
 * Shown the first time the user trips Rain's withdrawal-signature lock in a
 * session, so the floating timer that follows is not mysterious. Dismissing
 * the modal hands off to the persistent `RainCooldownFloatingTimer` widget.
 */
const RainCooldownIntroModal = () => {
    const t = useTranslations('global')
    const tCommon = useTranslations('common')
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
            iconContainerClassName="bg-action-secondary"
            title={t('rainCooldownIntroModal.title')}
            description={t('rainCooldownIntroModal.description')}
            ctas={[
                {
                    text: tCommon('gotIt'),
                    variant: 'purple',
                    shadowSize: '4',
                    onClick: dismissIntroModal,
                },
            ]}
            footer={
                <div className="pt-2 text-center">
                    {/* DocsLink keeps the locale + native behavior; the chrome is LinkButton's. */}
                    <DocsLink href="/en/help/card-collateral" className={LINK_BUTTON_CLASSES}>
                        {t('rainCooldownIntroModal.readMore')}
                    </DocsLink>
                </div>
            }
        />
    )
}

export default RainCooldownIntroModal
