'use client'

import { useTranslations } from 'next-intl'
import ActionModal from '../Global/ActionModal'
import KycPrepChecklist, { type KycPrepPath } from '@/components/Kyc/KycPrepChecklist'
import { PeanutDoesntStoreAnyPersonalInformation } from '@/components/Kyc/PeanutDoesntStoreAnyPersonalInformation'

interface UnlockMethodModalProps {
    visible: boolean
    onClose: () => void
    onUnlock: () => void
    /** Display label of the tapped method row (already localized). */
    methodLabel: string | null
    /** Which prep checklist applies: extended for Manteca (BR/AR), standard elsewhere. */
    path?: KycPrepPath
    isLoading?: boolean
}

/**
 * Method-worded unlock sheet for the Unlock payments screen. The tap promised
 * a product ("SEPA transfers · Unlock"), so the sheet speaks about that
 * product — never about regions. The body is the prep checklist: what to have
 * ready and how long it takes, stated BEFORE the SDK opens, so nobody starts
 * the check and then goes hunting for documents halfway through.
 */
const UnlockMethodModal = ({
    visible,
    onClose,
    onUnlock,
    methodLabel,
    path = 'standard',
    isLoading,
}: UnlockMethodModalProps) => {
    const t = useTranslations('profile.unlockPayments.unlockModal')
    const tPrep = useTranslations('kyc.prep')
    const tCommon = useTranslations('common')

    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            title={methodLabel ? t('title', { method: methodLabel }) : t('titleGeneric')}
            description={<KycPrepChecklist path={path} />}
            descriptionClassName="text-black"
            icon="shield"
            iconContainerClassName="bg-primary-1"
            iconProps={{ className: 'text-black' }}
            ctas={[
                {
                    shadowSize: '4',
                    icon: 'check-circle',
                    text: isLoading ? tCommon('loading') : tPrep('startCta'),
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
            footer={<PeanutDoesntStoreAnyPersonalInformation className="w-full justify-center" />}
        />
    )
}

export default UnlockMethodModal
