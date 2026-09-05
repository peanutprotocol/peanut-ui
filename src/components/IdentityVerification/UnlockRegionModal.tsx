'use client'

import { useTranslations } from 'next-intl'
import ActionModal from '../Global/ActionModal'
import Card from '@/components/Global/Card'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { Icon } from '../Global/Icons/Icon'
import { type Region } from '@/utils/regions.utils'
import { useRegionLabel } from '@/hooks/useRegionLabel'
import React from 'react'

interface StartVerificationModalProps {
    visible: boolean
    onClose: () => void
    onStartVerification: () => void
    selectedRegion: Region | null
    isLoading?: boolean
}

type RailKey = 'europe' | 'uk' | 'us' | 'mexico' | 'qr' | 'latamBank' | 'fallback'

// region → rail pairs, so they render as label/value DataRows rather than a checklist
const BRIDGE_RAILS: RailKey[] = ['europe', 'uk', 'us', 'mexico', 'qr']
const REGION_RAILS: Record<string, RailKey[]> = {
    // Generic LATAM covers more countries than the local bank rails do — those
    // are Argentina and Brazil only — so the region preview promises just the
    // QR payments that hold across the whole intent. Picking either country
    // outright does preview its own-account transfers.
    latam: ['qr'],
    argentina: ['latamBank', 'qr'],
    brazil: ['latamBank', 'qr'],
    europe: BRIDGE_RAILS,
    'north-america': BRIDGE_RAILS,
    'rest-of-the-world': ['qr'],
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
    const regionLabel = useRegionLabel()
    const regionName = selectedRegion && regionLabel(selectedRegion).name

    // spelled out rather than built from a template key so next-intl's typed messages still check them
    const railCopy: Record<RailKey, { label: string; value: string }> = {
        europe: { label: t('rails.europe.label'), value: t('rails.europe.value') },
        uk: { label: t('rails.uk.label'), value: t('rails.uk.value') },
        us: { label: t('rails.us.label'), value: t('rails.us.value') },
        mexico: { label: t('rails.mexico.label'), value: t('rails.mexico.value') },
        qr: { label: t('rails.qr.label'), value: t('rails.qr.value') },
        latamBank: { label: t('rails.latamBank.label'), value: t('rails.latamBank.value') },
        fallback: { label: t('rails.fallback.label'), value: t('rails.fallback.value') },
    }

    const rails: RailKey[] = (selectedRegion && REGION_RAILS[selectedRegion.path]) ?? ['fallback']

    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            title={regionName ? t('unlockTitle', { region: regionName }) : t('unlockTitleGeneric')}
            description={<p>{t.rich('unlockDescription', { b: (chunks) => <b>{chunks}</b> })}</p>}
            // more than one block under the head → body reads left-aligned, not centered
            descriptionClassName="text-black text-left"
            icon="shield"
            iconContainerClassName="bg-action-primary"
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
                <div className="flex w-full flex-col items-start gap-2 text-left">
                    <p className="text-body-s text-foreground-secondary">{t('whatYoullUnlock')}</p>
                    <Card position="single" className="divide-y divide-dashed divide-border-default px-4 py-0">
                        {rails.map((rail) => (
                            <DataRow key={rail} label={railCopy[rail].label} value={railCopy[rail].value} />
                        ))}
                    </Card>
                    <div className="flex items-center gap-2">
                        <Icon name="info" size={16} className="text-foreground-secondary" />
                        <p className="text-body-xs text-foreground-secondary">{tKyc('doesntStoreDocumentsPeriod')}</p>
                    </div>
                </div>
            }
        />
    )
}

export default UnlockRegionModal
