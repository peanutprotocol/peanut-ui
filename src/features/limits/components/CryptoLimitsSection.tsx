'use client'

import Card from '@/components/Global/Card'
import { Section } from '@/components/0_Bruddle/Section'
import { Icon } from '@/components/Global/Icons/Icon'
import { Tooltip } from '@/components/Tooltip'
import { useTranslations } from 'next-intl'

/**
 * displays crypto limits section - crypto transactions have no limits
 */
export default function CryptoLimitsSection() {
    const t = useTranslations('limits.crypto')
    return (
        <Section title={t('title')}>
            <Card position="single" className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                    <span className="text-body-s">{t('noLimits')}</span>
                    <Tooltip content={t('tooltip')} position="top">
                        <Icon name="info" className="cursor-pointer text-foreground-secondary" size={16} />
                    </Tooltip>
                </div>
            </Card>
        </Section>
    )
}
