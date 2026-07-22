'use client'

import Modal from '@/components/Global/Modal'
import InfoCard from '@/components/Global/InfoCard'
import EvmChainChips from './EvmChainChips'
import { useTranslations } from 'next-intl'

interface SupportedNetworksModalProps {
    visible: boolean
    onClose: () => void
}

const SupportedNetworksModal = ({ visible, onClose }: SupportedNetworksModalProps) => {
    const t = useTranslations('addMoney.supportedNetworksModal')
    return (
        <Modal
            visible={visible}
            onClose={onClose}
            classWrap="sm:m-auto sm:self-center self-center m-4 bg-background rounded-sm"
        >
            <div className="flex flex-col gap-4 p-5">
                <h3 className={'text-start text-h6 font-bold text-black'}>{t('title')}</h3>
                <p className="text-sm text-grey-1">{t('description')}</p>

                <div className="flex flex-wrap gap-2">
                    <EvmChainChips />
                </div>

                <InfoCard variant="warning" icon="alert" title={t('warning')} />
            </div>
        </Modal>
    )
}

export default SupportedNetworksModal
