import { useLocale, useTranslations } from 'next-intl'
import ActionModal from '@/components/Global/ActionModal'
import { useKycControl } from '@/features/paperwork-verification/analytics'

export const KycRestartCooldownModal = ({
    cooldown,
    onClose,
}: {
    cooldown?: { retryAt?: string } | null
    onClose: () => void
}) => {
    const { track } = useKycControl('restart-cooldown', 'kyc_status')
    const t = useTranslations('profile.unlockPayments.cooldown')
    const locale = useLocale()
    return (
        <ActionModal
            visible={!!cooldown}
            onClose={() => {
                track('cooldown', 'dismiss')
                onClose()
            }}
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
            tone="attention"
            ctas={[
                {
                    text: t('dismiss'),
                    variant: 'primary',
                    onClick: () => {
                        track('got_it', 'tap')
                        onClose()
                    },
                },
            ]}
        />
    )
}
