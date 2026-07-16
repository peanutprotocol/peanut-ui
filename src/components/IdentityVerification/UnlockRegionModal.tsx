'use client'

import { useTranslations } from 'next-intl'
import ActionModal from '../Global/ActionModal'
import InfoCard from '../Global/InfoCard'
import { Icon } from '../Global/Icons/Icon'
import { type Region } from '@/utils/regions.utils'
import React from 'react'

interface StartVerificationModalProps {
    visible: boolean
    onClose: () => void
    onStartVerification: () => void
    selectedRegion: Region | null
    isLoading?: boolean
}

const UnlockRegionModal = ({
    visible,
    onClose,
    onStartVerification,
    selectedRegion,
    isLoading,
}: StartVerificationModalProps) => {
    const t = useTranslations('identity')
    const tKyc = useTranslations('kyc')
    const tCommon = useTranslations('common')

    const bold = { b: (chunks: React.ReactNode) => <b>{chunks}</b> }
    const qrPayments = <p key="qr">{t.rich('qrPayments', bold)}</p>
    const bridgeUnlockItems: Array<string | React.ReactNode> = [
        <p key="sepa">{t.rich('sepaTransfers', bold)}</p>,
        <p key="uk">{t.rich('ukFasterPayments', bold)}</p>,
        <p key="ach">{t.rich('usAchWire', bold)}</p>,
        <p key="mx">{t.rich('mxSpei', bold)}</p>,
        qrPayments,
    ]

    // unlock benefits shown per region
    const regionUnlockItems: Record<string, Array<string | React.ReactNode>> = {
        latam: [<p key="bank">{t.rich('latamBankTransfers', bold)}</p>, qrPayments],
        europe: bridgeUnlockItems,
        'north-america': bridgeUnlockItems,
        'rest-of-the-world': [qrPayments],
    }

    const defaultUnlockItems = [<p key="bank">{t('defaultUnlockItem')}</p>]

    const unlockItems = selectedRegion
        ? (regionUnlockItems[selectedRegion.path] ?? defaultUnlockItems)
        : defaultUnlockItems

    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            title={selectedRegion?.name ? t('unlockTitle', { region: selectedRegion.name }) : t('unlockTitleGeneric')}
            description={<p>{t.rich('unlockDescription', bold)}</p>}
            descriptionClassName="text-black"
            icon="shield"
            iconContainerClassName="bg-primary-1"
            iconProps={{ className: 'text-black' }}
            ctas={[
                {
                    shadowSize: '4',
                    icon: 'check-circle',
                    text: isLoading ? tCommon('loading') : t('unlockNow'),
                    onClick: onStartVerification,
                    disabled: isLoading,
                },
            ]}
            content={
                <div className="flex w-full flex-col items-start gap-2">
                    <h2 className="text-xs font-bold">{t('whatYoullUnlock')}</h2>
                    <InfoCard
                        variant="info"
                        itemIcon="check"
                        itemIconSize={12}
                        itemIconClassName="text-secondary-7"
                        items={unlockItems}
                    />
                    <div className="flex items-center gap-2">
                        <Icon name="info" size={12} className="text-gray-1" />
                        <p className="text-xs text-gray-1">{tKyc('doesntStoreDocumentsPeriod')}</p>
                    </div>
                </div>
            }
        />
    )
}

export default UnlockRegionModal
