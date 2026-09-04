'use client'

import ActionModal from '@/components/Global/ActionModal'
import { Notification } from '@/components/0_Bruddle/Notification'
import EvmChainChips from './EvmChainChips'
import { useTranslations } from 'next-intl'

interface SupportedNetworksModalProps {
    visible: boolean
    onClose: () => void
}

const SupportedNetworksModal = ({ visible, onClose }: SupportedNetworksModalProps) => {
    const t = useTranslations('addMoney.supportedNetworksModal')
    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            // same bright-yellow bubble as TokenAndNetworkConfirmationModal — the two
            // screens carry the same permanent-loss warning and should read alike
            icon="alert"
            iconContainerClassName="bg-background-icon-bubble-yellow"
            title={t('title')}
            description={t('description')}
            descriptionClassName="mt-3"
            ctas={[
                {
                    text: t('cta'),
                    shadowSize: '4',
                    onClick: onClose,
                },
            ]}
            content={
                <div className="flex w-full flex-col gap-4 text-left">
                    <div className="flex flex-wrap gap-2">
                        <EvmChainChips />
                    </div>
                    <Notification priority="attention">{t('warning')}</Notification>
                </div>
            }
        />
    )
}

export default SupportedNetworksModal
