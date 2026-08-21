'use client'

import { useTranslations } from 'next-intl'
import ActionModal from '../Global/ActionModal'

interface UnlockMethodModalProps {
    visible: boolean
    onClose: () => void
    onUnlock: () => void
    /** Display label of the tapped method row (already localized). */
    methodLabel: string | null
    isLoading?: boolean
}

/**
 * Method-worded unlock sheet for the Unlock payments screen. The tap promised
 * a product ("SEPA transfers · Unlock"), so the sheet speaks about that
 * product — never about regions. Copy is honest about the two possible costs:
 * covered verifications switch on right away, anything else shows its
 * requirements before the SDK opens.
 */
const UnlockMethodModal = ({ visible, onClose, onUnlock, methodLabel, isLoading }: UnlockMethodModalProps) => {
    const t = useTranslations('profile.unlockPayments.unlockModal')
    const tCommon = useTranslations('common')

    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            title={methodLabel ? t('title', { method: methodLabel }) : t('titleGeneric')}
            description={<p>{t('description')}</p>}
            descriptionClassName="text-black"
            icon="shield"
            iconContainerClassName="bg-primary-1"
            iconProps={{ className: 'text-black' }}
            ctas={[
                {
                    shadowSize: '4',
                    icon: 'check-circle',
                    text: isLoading ? tCommon('loading') : t('cta'),
                    disabled: isLoading,
                    onClick: onUnlock,
                    variant: 'purple',
                },
                {
                    text: t('notNow'),
                    onClick: onClose,
                    variant: 'stroke',
                },
            ]}
        />
    )
}

export default UnlockMethodModal
