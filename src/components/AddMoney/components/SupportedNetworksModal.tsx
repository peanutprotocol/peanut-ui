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
            title={t('title')}
            description={t('description')}
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
