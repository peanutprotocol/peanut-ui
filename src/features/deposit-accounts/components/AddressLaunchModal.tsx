import { useTranslations } from 'next-intl'
import ActionModal from '@/components/Global/ActionModal'
import { Callout } from '@/components/0_Bruddle/Callout'

export function AddressLaunchModal({
    visible,
    loading,
    error,
    terminal,
    onClose,
    onRetry,
    onContactSupport,
}: {
    visible: boolean
    loading: boolean
    error: string | null
    terminal: boolean
    onClose: () => void
    onRetry: () => void
    onContactSupport: () => void
}) {
    const t = useTranslations('depositAccounts')
    const common = useTranslations('common')
    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            title={t('gate.addressTitle')}
            tone={error ? 'error' : 'info'}
            isLoadingIcon={loading}
            content={
                loading ? (
                    <div role="status" aria-busy="true">
                        {common('loading')}
                    </div>
                ) : error ? (
                    <Callout priority="error">{error}</Callout>
                ) : undefined
            }
            ctas={
                loading
                    ? undefined
                    : [
                          {
                              text: common(terminal ? 'contactSupport' : 'retry'),
                              variant: 'primary',
                              onClick: terminal ? onContactSupport : onRetry,
                          },
                      ]
            }
        />
    )
}
