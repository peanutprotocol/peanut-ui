import { useLocale, useTranslations } from 'next-intl'
import ActionModal from '@/components/Global/ActionModal'

export const KycRestartCooldownModal = ({
    cooldown,
    onClose,
}: {
    cooldown?: { retryAt?: string } | null
    onClose: () => void
}) => {
    const t = useTranslations('profile.unlockPayments.cooldown')
    const locale = useLocale()
    return (
        <ActionModal
            visible={!!cooldown}
            onClose={onClose}
            title={t('title')}
            description={
                cooldown?.retryAt
                    ? t('until', {
                          until: new Date(cooldown.retryAt).toLocaleString(locale, {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                          }),
                      })
                    : t('short')
            }
            tone="warning"
            ctas={[{ text: t('dismiss'), variant: 'purple', onClick: onClose }]}
        />
    )
}
