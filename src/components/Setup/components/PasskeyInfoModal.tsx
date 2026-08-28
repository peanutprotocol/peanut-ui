'use client'

import ActionModal from '@/components/Global/ActionModal'
import DocsLink from '@/components/Global/DocsLink'
import { useTranslations } from 'next-intl'

/**
 * In-app passkey explainer for the setup flow. Mid-signup, ejecting the user
 * into a browser tab (the old DocsLink behavior) risks losing them right
 * before the passkey ceremony — the short answer lives here, and the full
 * help-center guide stays one tap away for those who want it.
 */
const PasskeyInfoModal = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
    const t = useTranslations('setup.passkey.info')
    const tCommon = useTranslations('common')

    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            title={t('title')}
            icon="lock"
            iconContainerClassName="bg-action-primary"
            iconProps={{ className: 'text-black' }}
            description={
                <div className="flex flex-col gap-3 text-left text-body-s">
                    <p>{t('what')}</p>
                    <p>{t('backup')}</p>
                    <p>{t('privacy')}</p>
                    <p className="text-body-xs text-foreground-secondary">
                        <DocsLink href="/en/help/passkeys" className="underline underline-offset-2">
                            {t('fullGuide')}
                        </DocsLink>
                    </p>
                </div>
            }
            descriptionClassName="text-black"
            ctas={[
                {
                    shadowSize: '4',
                    text: tCommon('gotIt'),
                    onClick: onClose,
                    variant: 'purple',
                },
            ]}
        />
    )
}

export default PasskeyInfoModal
