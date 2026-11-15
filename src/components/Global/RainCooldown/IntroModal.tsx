'use client'

import ActionModal from '@/components/Global/ActionModal'
import { useTranslations } from 'next-intl'
import { useRainCooldown } from '@/context/RainCooldownContext'
import DocsLink from '@/components/Global/DocsLink'
import { LINK_BUTTON_CLASSES } from '@/components/0_Bruddle/LinkButton'
import { useCooldownRemaining } from '@/hooks/useCooldownRemaining'

/** Introduces the countdown before handing it off to the persistent toast. */
const RainCooldownIntroModal = () => {
    const t = useTranslations('global')
    const tCommon = useTranslations('common')
    const { cooldownEndsAt, showIntroModal, dismissIntroModal } = useRainCooldown()
    const remaining = useCooldownRemaining()
    return (
        <ActionModal
            visible={showIntroModal && cooldownEndsAt !== null}
            onClose={dismissIntroModal}
            tone="attention"
            icon="clock"
            title={t('rainCooldownIntroModal.title')}
            description={
                <div className="flex flex-col gap-2">
                    {remaining && <p className="text-heading-s text-foreground-primary tabular-nums">{remaining}</p>}
                    <p>{t('rainCooldownIntroModal.description')}</p>
                </div>
            }
            ctas={[
                {
                    text: tCommon('gotIt'),
                    variant: 'primary',
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
