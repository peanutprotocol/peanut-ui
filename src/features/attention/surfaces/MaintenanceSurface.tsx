'use client'

import { useTranslations } from 'next-intl'
import { Callout } from '@/components/0_Bruddle/Callout'
import { useAttentionOptional } from '../AttentionProvider'
import type { BannerSurfaceProps, JourneyState } from '../types'

export function MaintenanceCallout({
    maintenance,
    variant,
    className,
}: {
    maintenance: JourneyState['maintenance']
    variant: BannerSurfaceProps['variant']
    className?: string
}) {
    const t = useTranslations('global')
    if (maintenance === 'none') return null
    if (maintenance === 'scoped' && variant === 'feature') {
        return (
            <Callout priority="error" title={t('maintenanceTitle')} className={className}>
                {t('maintenanceBody')}
            </Callout>
        )
    }
    return (
        <Callout priority="error" className={className}>
            {t('maintenanceBanner')}
        </Callout>
    )
}

export default function MaintenanceSurface({ variant, className }: BannerSurfaceProps) {
    const attention = useAttentionOptional()
    return (
        <MaintenanceCallout
            maintenance={attention?.state.maintenance ?? 'none'}
            variant={variant}
            className={className}
        />
    )
}
