'use client'

import { Suspense, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import maintenanceConfig from '@/config/underMaintenance.config'
import { IS_PRODUCTION } from '@/constants/general.consts'
import { isDemoMode } from '@/utils/demo'
import { logRunMode } from '@/utils/mode'
import { useAttentionOptional } from './AttentionProvider'
import { SurfaceBoundary } from './AttentionInterrupt'
import { BANNER_SURFACES } from './bannerSurfaces'
import { selectMaintenance } from './maintenance'
import { MaintenanceCallout } from './surfaces/MaintenanceSurface'

export interface AttentionBannerProps {
    variant?: 'feature' | 'global'
    className?: string
}

export function AttentionBanner({ variant = 'global', className = 'mx-4 mt-2' }: AttentionBannerProps) {
    const attention = useAttentionOptional()
    const pathname = usePathname()
    const id = attention?.decision.banner
    const Surface = id ? BANNER_SURFACES[id] : undefined
    const openedSurface = attention?.openedSurface
    useEffect(() => {
        if (!IS_PRODUCTION) logRunMode()
    }, [])
    useEffect(() => {
        if (id && Surface) openedSurface?.(id, 'banner')
    }, [id, Surface, openedSurface])
    if (!attention) {
        return (
            <MaintenanceCallout
                maintenance={selectMaintenance({ pathname, config: maintenanceConfig, demo: isDemoMode() })}
                variant={variant}
                className={className}
            />
        )
    }
    if (!id || !Surface) return null
    return (
        <SurfaceBoundary
            key={`${attention.state.userId}:${id}`}
            askId={id}
            onCrash={() => attention.crashed(id, 'banner')}
        >
            <Suspense fallback={null}>
                <Surface
                    askId={id}
                    variant={variant}
                    className={className}
                    onActed={() => attention.acted(id, 'banner')}
                    onDismissed={() => attention.dismissed(id, 'banner')}
                    onSnoozed={(until) => attention.snoozed(id, until, 'banner')}
                />
            </Suspense>
        </SurfaceBoundary>
    )
}

export default AttentionBanner
