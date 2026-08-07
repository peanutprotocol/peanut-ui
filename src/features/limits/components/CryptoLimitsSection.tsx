'use client'

import Card from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import { Tooltip } from '@/components/Tooltip'
import { useTranslations } from 'next-intl'

/**
 * displays crypto limits section - crypto transactions have no limits
 */
export default function CryptoLimitsSection() {
    const t = useTranslations('limits.crypto')
    return (
        <div className="space-y-2">
            <h2 className="font-bold">{t('title')}</h2>
            <Card position="single" className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                    <span className="text-sm">{t('noLimits')}</span>
                    <Tooltip content={t('tooltip')} position="top">
                        <Icon name="info" className="cursor-pointer text-grey-1" size={18} />
                    </Tooltip>
                </div>
            </Card>
        </div>
    )
}
